import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('mdm-service:policy');
export const policyRouter: Router = Router();

// Admin-only — secured by internal secret
policyRouter.use((req: Request, res: Response, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

policyRouter.get('/', async (_req: Request, res: Response) => {
  const policies = await prisma.mdmPolicy.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ success: true, data: policies });
});

policyRouter.post('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      allowedApps: z.array(z.string()),
      blockedApps: z.array(z.string()),
      wifiNetworks: z.any().optional(),
      screenLockSecs: z.number().int().default(300),
      requireEncrypt: z.boolean().default(true),
      disableCamera: z.boolean().default(false),
      disableBluetooth: z.boolean().default(false),
      policyJson: z.record(z.unknown()),
    });

    const body = schema.parse(req.body);

    const policy = await prisma.mdmPolicy.create({
      data: {
        ...body,
        version: 1,
        policyJson: body.policyJson as Prisma.InputJsonValue,
        wifiNetworks: body.wifiNetworks as Prisma.InputJsonValue | undefined,
      },
    });
    logger.info('Policy created', { id: policy.id });
    res.status(201).json({ success: true, data: policy });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid policy' });
  }
});

// Device fetches its policy
policyRouter.get('/device/:deviceId', async (req: Request, res: Response) => {
  const deviceId = Array.isArray(req.params.deviceId) ? req.params.deviceId[0] : req.params.deviceId;
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device?.mdmEnrolled) {
    res.status(404).json({ error: 'Device not enrolled' });
    return;
  }

  const policy = await prisma.mdmPolicy.findFirst({ where: { isActive: true } });
  if (!policy) {
    res.json({ success: true, data: { policyVersion: 0, policy: {} } });
    return;
  }

  res.json({
    success: true,
    data: {
      policyVersion: policy.version,
      needsUpdate: device.policyVersion < policy.version,
      policy: policy.policyJson,
      allowedApps: policy.allowedApps,
      blockedApps: policy.blockedApps,
    },
  });
});
