import { Router, Request, Response } from 'express';
import { prisma } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('mdm-service:device-sync');
export const deviceSyncRouter = Router();

// Device heartbeat — reports status and receives policy updates
deviceSyncRouter.post('/:deviceId/checkin', async (req: Request, res: Response) => {
  try {
    const { batteryLevel, storageUsedMb, totalStorageMb, appVersion, installedApps, policyVersion } = req.body as {
      batteryLevel?: number;
      storageUsedMb?: number;
      totalStorageMb?: number;
      appVersion?: string;
      installedApps?: string[];
      policyVersion?: number;
    };

    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId } });
    if (!device?.mdmEnrolled) {
      res.status(403).json({ error: 'Device not enrolled' });
      return;
    }

    await prisma.device.update({
      where: { id: req.params.deviceId },
      data: {
        lastSeenAt: new Date(),
        lastIp: req.ip,
        ...(batteryLevel !== undefined ? { batteryLevel } : {}),
        ...(storageUsedMb !== undefined ? { storageUsedMb } : {}),
        ...(totalStorageMb !== undefined ? { totalStorageMb } : {}),
        ...(appVersion ? { appVersion } : {}),
        ...(installedApps ? { installedApps } : {}),
      },
    });

    // Check for blocked apps
    const activePolicy = await prisma.mdmPolicy.findFirst({ where: { isActive: true } });
    let blockedAppsFound: string[] = [];
    if (activePolicy && installedApps) {
      blockedAppsFound = installedApps.filter((app) => activePolicy.blockedApps.includes(app));
    }

    if (blockedAppsFound.length > 0) {
      logger.warn('Blocked apps detected', { deviceId: req.params.deviceId, apps: blockedAppsFound });
      // Create alert
      await prisma.alert.create({
        data: {
          type: 'UNAUTHORIZED_APP',
          severity: 'HIGH',
          status: 'OPEN',
          employeeId: device.employeeId ?? undefined,
          title: 'Unauthorized Apps Detected',
          description: `Blocked apps found on device: ${blockedAppsFound.join(', ')}`,
          metadata: { deviceId: device.id, blockedApps: blockedAppsFound },
        },
      });
    }

    const needsPolicyUpdate = activePolicy ? (policyVersion ?? 0) < activePolicy.version : false;

    res.json({
      success: true,
      data: {
        needsPolicyUpdate,
        ...(needsPolicyUpdate && activePolicy ? {
          policy: activePolicy.policyJson,
          policyVersion: activePolicy.version,
          allowedApps: activePolicy.allowedApps,
          blockedApps: activePolicy.blockedApps,
        } : {}),
        commands: blockedAppsFound.length > 0 ? [{ action: 'UNINSTALL_APPS', packages: blockedAppsFound }] : [],
      },
    });
  } catch (err) {
    logger.error('Check-in failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Check-in failed' });
  }
});
