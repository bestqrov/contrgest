import { prisma, AlertType, AlertSeverity, AlertStatus } from '@field-ops/db';
import { notifier } from './notifier.service';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('alert-engine:device-offline');
const OFFLINE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours during work hours

class DeviceOfflineChecker {
  async run(): Promise<void> {
    const hour = new Date().getHours();
    // Only check during work hours (8–20 Casablanca time, approximate)
    if (hour < 7 || hour > 20) return;

    const threshold = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const offlineDevices = await prisma.device.findMany({
      where: {
        status: 'ACTIVE',
        mdmEnrolled: true,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lte: threshold } }],
        employee: { status: 'ACTIVE' },
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    for (const device of offlineDevices) {
      if (!device.employee) continue;

      const recentAlert = await prisma.alert.findFirst({
        where: {
          type: AlertType.DEVICE_OFFLINE,
          employeeId: device.employee.id,
          status: AlertStatus.OPEN,
          createdAt: { gte: new Date(Date.now() - 4 * 60 * 60_000) },
        },
      });

      if (recentAlert) continue;

      const employeeName = `${device.employee.firstName} ${device.employee.lastName}`;
      const lastSeen = device.lastSeenAt?.toLocaleString() ?? 'Never';

      await prisma.alert.create({
        data: {
          type: AlertType.DEVICE_OFFLINE,
          severity: AlertSeverity.MEDIUM,
          status: AlertStatus.OPEN,
          employeeId: device.employee.id,
          title: `Device Offline: ${employeeName}`,
          description: `Device ${device.model} (${device.imei}) last seen: ${lastSeen}`,
          metadata: { deviceId: device.id, imei: device.imei, lastSeenAt: device.lastSeenAt },
        },
      });

      await notifier.notifyOwner(
        'DEVICE_OFFLINE',
        `Device Offline: ${employeeName}`,
        `Device hasn't reported since ${lastSeen}`,
        employeeName,
      );

      logger.info('Device offline alert created', { deviceId: device.id, employee: device.employee.id });
    }
  }
}

export const deviceOfflineChecker = new DeviceOfflineChecker();
