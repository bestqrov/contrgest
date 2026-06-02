import { prisma, AlertStatus, AlertSeverity } from '@field-ops/db';
import { notifier } from './notifier.service';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('alert-engine:escalation');
const ESCALATION_MINUTES = parseInt(process.env.ALERT_ESCALATION_TIMEOUT_MINUTES ?? '30', 10);

class EscalationChecker {
  async run(): Promise<void> {
    const cutoff = new Date(Date.now() - ESCALATION_MINUTES * 60_000);

    const unacknowledged = await prisma.alert.findMany({
      where: {
        status: AlertStatus.OPEN,
        severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
        notifiedAt: null,
        createdAt: { lte: cutoff },
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    for (const alert of unacknowledged) {
      const employeeName = alert.employee
        ? `${alert.employee.firstName} ${alert.employee.lastName}`
        : undefined;

      await notifier.notifyOwner(alert.type, alert.title, alert.description, employeeName);

      await prisma.alert.update({
        where: { id: alert.id },
        data: { notifiedAt: new Date() },
      });

      logger.info('Escalated alert', { id: alert.id, type: alert.type });
    }
  }
}

export const escalationChecker = new EscalationChecker();
