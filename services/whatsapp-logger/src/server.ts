import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { webhookRouter } from './handlers/webhook.handler';

const logger = createLogger('whatsapp-logger');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4001', 10);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-logger' });
});

app.use('/webhook', webhookRouter);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('WhatsApp Logger started', { port: PORT });
});

process.on('SIGTERM', () => process.exit(0));
