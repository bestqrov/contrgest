import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@field-ops/db';
import { generateToken, createLogger } from '@field-ops/shared';
import Redis from 'ioredis';

const logger = createLogger('mdm-service:enrollment');
export const enrollmentRouter: Router = Router();

const redis = new Redis(process.env.REDIS_URL!);
const TOKEN_EXPIRY_HOURS = parseInt(process.env.MDM_ENROLLMENT_TOKEN_EXPIRES_HOURS ?? '48', 10);

const enrollSchema = z.object({
  imei: z.string().length(15),
  serialNumber: z.string().min(1),
  model: z.string().min(1),
  androidVersion: z.string().min(1),
  enrollmentToken: z.string().min(32),
});

// Generate enrollment token for a device (admin-triggered)
enrollmentRouter.post('/token', async (req: Request, res: Response) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { deviceId } = z.object({ deviceId: z.string() }).parse(req.body);

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const token = generateToken(32);
  const key = `mdm:enrollment:${token}`;
  await redis.setex(key, TOKEN_EXPIRY_HOURS * 3600, JSON.stringify({ deviceId, imei: device.imei }));

  logger.info('Enrollment token generated', { deviceId });
  res.json({ success: true, data: { token, expiresInHours: TOKEN_EXPIRY_HOURS } });
});

// Device calls this to complete enrollment
enrollmentRouter.post('/complete', async (req: Request, res: Response) => {
  try {
    const body = enrollSchema.parse(req.body);

    const key = `mdm:enrollment:${body.enrollmentToken}`;
    const tokenData = await redis.get(key);
    if (!tokenData) {
      res.status(401).json({ error: 'Invalid or expired enrollment token' });
      return;
    }

    const { deviceId } = JSON.parse(tokenData) as { deviceId: string };
    const appVersion = typeof req.body.appVersion === 'string' ? req.body.appVersion : undefined;

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.imei !== body.imei) {
      res.status(401).json({ error: 'IMEI mismatch' });
      return;
    }

    const activePolicy = await prisma.mdmPolicy.findFirst({ where: { isActive: true } });

    await prisma.device.update({
      where: { id: deviceId },
      data: {
        mdmEnrolled: true,
        mdmEnrolledAt: new Date(),
        mdmProfileId: activePolicy?.id,
        androidVersion: body.androidVersion,
        appVersion,
        policyVersion: activePolicy?.version ?? 0,
      },
    });

    await redis.del(key);

    logger.info('Device enrolled', { deviceId, imei: body.imei });
    res.json({
      success: true,
      data: {
        deviceId,
        policy: activePolicy?.policyJson ?? {},
        policyVersion: activePolicy?.version ?? 0,
      },
    });
  } catch (err) {
    logger.error('Enrollment failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Enrollment failed' });
  }
});
