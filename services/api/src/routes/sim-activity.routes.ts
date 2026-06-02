import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, SimActivityType } from '@field-ops/db';
import { authenticateDevice, authenticate, requireRole } from '../middleware/auth.middleware';
import { parsePagination, buildMeta } from '@field-ops/shared';

export const simActivityRouter = Router();

const batchSchema = z.object({
  deviceId: z.string(),
  employeeId: z.string(),
  activities: z.array(z.object({
    simSlot: z.number().int().min(0).max(1),
    simNumber: z.string().optional(),
    activityType: z.nativeEnum(SimActivityType),
    contactNumber: z.string().optional(),
    content: z.string().optional(),
    durationSecs: z.number().int().optional(),
    timestamp: z.string().datetime(),
  })),
});

// Device → POST batch SIM activity
simActivityRouter.post('/batch', authenticateDevice, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = batchSchema.parse(req.body);

    const records = await prisma.$transaction(
      body.activities.map((a) =>
        prisma.simActivity.create({
          data: {
            deviceId: body.deviceId,
            employeeId: body.employeeId,
            simSlot: a.simSlot,
            simNumber: a.simNumber,
            activityType: a.activityType,
            contactNumber: a.contactNumber,
            content: a.content,
            durationSecs: a.durationSecs,
            timestamp: new Date(a.timestamp),
          },
        })
      )
    );

    res.status(201).json({ success: true, count: records.length });
  } catch (err) {
    next(err);
  }
});

// Admin → GET paginated sim activity per employee
simActivityRouter.get('/', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const { employeeId, deviceId, isFlagged } = req.query;

    const where = {
      ...(employeeId ? { employeeId: String(employeeId) } : {}),
      ...(deviceId ? { deviceId: String(deviceId) } : {}),
      ...(isFlagged !== undefined ? { isFlagged: isFlagged === 'true' } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.simActivity.findMany({ where, skip, take, orderBy: { timestamp: 'desc' } }),
      prisma.simActivity.count({ where }),
    ]);

    res.json({ success: true, data: records, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});
