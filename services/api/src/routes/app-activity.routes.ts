import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@field-ops/db';
import { authenticateDevice, authenticate, requireRole } from '../middleware/auth.middleware';
import { parsePagination, buildMeta } from '@field-ops/shared';

export const appActivityRouter = Router();

const batchSchema = z.object({
  deviceId: z.string(),
  employeeId: z.string(),
  activities: z.array(z.object({
    packageName: z.string(),
    appLabel: z.string().optional(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    durationSecs: z.number().int().optional(),
  })),
});

const SUSPICIOUS_PACKAGES = [
  'com.whatsapp.w4b',    // WhatsApp Business (personal)
  'org.telegram.messenger',
  'com.viber.voip',
  'com.snapchat.android',
  'app.getdelta.android', // Delta for Telegram
];

// Device → POST batch app usage
appActivityRouter.post('/batch', authenticateDevice, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = batchSchema.parse(req.body);

    const records = await prisma.$transaction(
      body.activities.map((a) =>
        prisma.appActivity.create({
          data: {
            deviceId: body.deviceId,
            employeeId: body.employeeId,
            packageName: a.packageName,
            appLabel: a.appLabel,
            startedAt: new Date(a.startedAt),
            endedAt: a.endedAt ? new Date(a.endedAt) : undefined,
            durationSecs: a.durationSecs,
            isSuspicious: SUSPICIOUS_PACKAGES.includes(a.packageName),
          },
        })
      )
    );

    res.status(201).json({ success: true, count: records.length });
  } catch (err) {
    next(err);
  }
});

// Admin → GET paginated app activity
appActivityRouter.get('/', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const { employeeId, deviceId, isSuspicious, packageName } = req.query;

    const where = {
      ...(employeeId ? { employeeId: String(employeeId) } : {}),
      ...(deviceId ? { deviceId: String(deviceId) } : {}),
      ...(isSuspicious !== undefined ? { isSuspicious: isSuspicious === 'true' } : {}),
      ...(packageName ? { packageName: String(packageName) } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.appActivity.findMany({ where, skip, take, orderBy: { startedAt: 'desc' } }),
      prisma.appActivity.count({ where }),
    ]);

    res.json({ success: true, data: records, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});
