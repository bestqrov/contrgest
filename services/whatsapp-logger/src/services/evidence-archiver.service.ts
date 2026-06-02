import axios from 'axios';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('whatsapp-logger:evidence-archiver');

class EvidenceArchiver {
  async archiveFromUrl(mediaUrl: string, messageId: string, mimeHint: string): Promise<void> {
    const vaultUrl = process.env.EVIDENCE_VAULT_INTERNAL_URL;
    if (!vaultUrl) return;

    try {
      await axios.post(
        `${vaultUrl}/internal/archive-from-url`,
        {
          url: mediaUrl,
          linkedTo: { type: 'message', id: messageId },
          mimeHint,
        },
        {
          headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET },
          timeout: 30_000,
        },
      );
    } catch (err) {
      // Non-critical: log and continue
      logger.warn('Evidence archival failed', {
        messageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const evidenceArchiver = new EvidenceArchiver();
