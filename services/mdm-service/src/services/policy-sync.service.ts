import { prisma } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('mdm-service:policy-sync');

class PolicySyncJob {
  async run(): Promise<void> {
    const activePolicy = await prisma.mdmPolicy.findFirst({ where: { isActive: true } });
    if (!activePolicy) return;

    // Find devices that have stale policy versions
    const staleDevices = await prisma.device.findMany({
      where: {
        mdmEnrolled: true,
        status: 'ACTIVE',
        policyVersion: { lt: activePolicy.version },
      },
      select: { id: true, imei: true, policyVersion: true },
    });

    if (staleDevices.length > 0) {
      logger.info('Devices with stale policy', { count: staleDevices.length });
      // Devices will pick up the new policy on their next check-in
      // This job just logs the count for monitoring
    }
  }
}

export const policySyncJob = new PolicySyncJob();
