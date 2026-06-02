import { Router, Request, Response } from 'express';
import { verifyHmac, createLogger } from '@field-ops/shared';
import { messageProcessor } from '../services/message-processor.service';

const logger = createLogger('whatsapp-logger:webhook');
export const webhookRouter = Router();

// Evolution API sends events here
webhookRouter.post('/evolution', async (req: Request, res: Response) => {
  // Verify HMAC signature from Evolution API
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

  // Respond 200 immediately — Evolution API expects fast ACK
  res.json({ received: true });

  const event = req.body as EvolutionWebhookEvent;
  logger.debug('Webhook event received', { event: event.event, instance: event.instance });

  try {
    await messageProcessor.handle(event);
  } catch (err) {
    logger.error('Failed to process webhook event', {
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
