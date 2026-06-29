import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, MarketingChannel } from '@field-ops/db';
import { authenticateDevice, authenticate, requireRole } from '../middleware/auth.middleware';
import { parsePagination, buildMeta, sha256Hex } from '@field-ops/shared';

export const marketingMessageRouter: Router = Router();

const logSchema = z.object({
  deviceId: z.string(),
  employeeId: z.string(),
  channel: z.nativeEnum(MarketingChannel),
  recipients: z.array(z.string()).min(1),
  content: z.string().min(1),
  subject: z.string().optional(),
  sentAt: z.string().datetime(),
});

// Device → POST log a marketing message BEFORE sending
marketingMessageRouter.post('/', authenticateDevice, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = logSchema.parse(req.body);
    const contentHash = sha256Hex(body.content);

    const record = await prisma.marketingMessage.create({
      data: {
        deviceId: body.deviceId,
        employeeId: body.employeeId,
        channel: body.channel,
        recipients: body.recipients,
        content: body.content,
        subject: body.subject,
        sentAt: new Date(body.sentAt),
        recipientCount: body.recipients.length,
        sha256Hash: contentHash,
      },
    });

    res.status(201).json({ success: true, data: { id: record.id, sha256Hash: contentHash } });
  } catch (err) {
    next(err);
  }
});

// Admin → GET paginated marketing messages
marketingMessageRouter.get('/', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const { employeeId, isFlagged, channel } = req.query;

    const where = {
      ...(employeeId ? { employeeId: String(employeeId) } : {}),
      ...(isFlagged !== undefined ? { isFlagged: isFlagged === 'true' } : {}),
      ...(channel ? { channel: channel as MarketingChannel } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.marketingMessage.findMany({ where, skip, take, orderBy: { sentAt: 'desc' } }),
      prisma.marketingMessage.count({ where }),
    ]);

    res.json({ success: true, data: records, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});
