import { prisma, AlertType, AlertSeverity, AlertStatus } from '@field-ops/db';
import { notifier } from './notifier.service';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('alert-engine:contract-expiry');

class ContractExpiryChecker {
  async run(): Promise<void> {
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const expiring = await prisma.contract.findMany({
      where: {
        endDate: { gte: now, lte: thirtyDaysOut },
        renewalAlerted: false,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    for (const contract of expiring) {
      const daysLeft = Math.ceil((contract.endDate!.getTime() - now.getTime()) / 86_400_000);
      const severity = daysLeft <= 7 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;
      const employeeName = `${contract.employee.firstName} ${contract.employee.lastName}`;

      await prisma.alert.create({
        data: {
          type: AlertType.CONTRACT_EXPIRY,
          severity,
          status: AlertStatus.OPEN,
          employeeId: contract.employee.id,
          title: `Contract Expiring Soon: ${employeeName}`,
          description: `Contract ${contract.contractNumber} expires in ${daysLeft} days (${contract.endDate!.toLocaleDateString()})`,
          metadata: { contractId: contract.id, daysLeft },
        },
      });

      await prisma.contract.update({
        where: { id: contract.id },
        data: { renewalAlerted: true },
      });

      await notifier.notifyOwner(
        'CONTRACT_EXPIRY',
        `Contract Expiring: ${employeeName}`,
        `${daysLeft} days until contract ${contract.contractNumber} expires`,
        employeeName,
      );

      logger.info('Contract expiry alert created', { contractId: contract.id, daysLeft });
    }
  }
}

export const contractExpiryChecker = new ContractExpiryChecker();
