import { Router, Request, Response, IRouter } from 'express';
import { verifyHmac, sha256Hex, createLogger } from '@field-ops/shared';
import { prisma } from '@field-ops/db';
import { waEventsQueue } from '../queues';

const logger = createLogger('whatsapp-logger:webhook');
export const webhookRouter: IRouter = Router();

webhookRouter.post('/evolution', async (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string | undefined;
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET!;

  if (signature && secret) {
    const body = JSON.stringify(req.body);
    if (!verifyHmac(body, secret, signature)) {
      logger.warn('Invalid webhook signature rejected');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  // Must ACK Evolution API in <200ms
  res.json({ received: true });

  const event = req.body as EvolutionWebhookEvent;

  try {
    const payloadStr = JSON.stringify(event);
    const hash = sha256Hex(payloadStr);
    const payloadBytes = Buffer.byteLength(payloadStr, 'utf8');

    // Immutable raw event insert (upsert deduplicates retries)
    const raw = await prisma.rawWebhookEvent.upsert({
      where: { sha256Hash: hash },
      update: {},
      create: {
        sha256Hash: hash,
        event: event.event ?? 'unknown',
        instance: event.instance ?? 'unknown',
        rawPayload: event as object,
        payloadBytes,
      },
    });

    // Only enqueue if newly inserted (not already processed)
    if (!raw.processedAt) {
      await waEventsQueue.add(
        event.event ?? 'unknown',
        { rawEventId: raw.id, event },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    }
  } catch (err) {
    logger.error('Failed to store raw webhook event', {
      error: err instanceof Error ? err.message : String(err),
      event: event.event,
    });
  }
});

export interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: Record<string, unknown>;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
}
