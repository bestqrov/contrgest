import { prisma, AlertType, AlertSeverity, AlertStatus } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';
import axios from 'axios';

const logger = createLogger('whatsapp-logger:flag-checker');

// Arabic and French keywords to watch for policy violations
const VIOLATION_PATTERNS = [
  { pattern: /concurrenc[ei]/i, reason: 'Competitor mention' },
  { pattern: /prix\s+perso/i, reason: 'Unauthorized personal pricing' },
  { pattern: /paye[rz]\s+cash\s+direct/i, reason: 'Off-book cash transaction' },
  { pattern: /whatsapp\s+perso/i, reason: 'Redirect to personal WhatsApp' },
  { pattern: /telegram/i, reason: 'Redirect to Telegram' },
  // Add Arabic patterns as needed
  { pattern: /منافس/i, reason: 'Competitor mention (Arabic)' },
  { pattern: /نقدي\s+مباشر/i, reason: 'Off-book cash (Arabic)' },
];

interface FlagResult {
  isFlagged: boolean;
  reason?: string;
}

class FlagChecker {
  async check(
    messageId: string,
    content: string | null,
    _type: string,
    employeeId: string,
  ): Promise<FlagResult> {
    if (!content) return { isFlagged: false };

    for (const { pattern, reason } of VIOLATION_PATTERNS) {
      if (pattern.test(content)) {
        logger.warn('Message flagged', { messageId, reason, employeeId });

        // Create alert
        await this.createAlert(employeeId, messageId, reason);

        return { isFlagged: true, reason };
      }
    }

    return { isFlagged: false };
  }

  private async createAlert(employeeId: string, messageId: string, reason: string): Promise<void> {
    try {
      await prisma.alert.create({
        data: {
          type: AlertType.WHATSAPP_VIOLATION,
          severity: AlertSeverity.HIGH,
          status: AlertStatus.OPEN,
          employeeId,
          title: 'WhatsApp Policy Violation Detected',
          description: `Message flagged: ${reason}`,
          metadata: { messageId, reason },
        },
      });

      // Notify alert engine
      const alertEngineUrl = process.env.ALERT_ENGINE_INTERNAL_URL;
      if (alertEngineUrl) {
        await axios.post(
          `${alertEngineUrl}/internal/notify`,
          { type: 'WHATSAPP_VIOLATION', employeeId, reason, messageId },
          { headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET }, timeout: 5000 },
        ).catch((err) => logger.warn('Alert engine notification failed', { error: err.message }));
      }
    } catch (err) {
      logger.error('Failed to create violation alert', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export const flagChecker = new FlagChecker();
