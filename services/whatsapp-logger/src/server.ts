import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { webhookRouter } from './handlers/webhook.handler';
import { createEventsWorker, createMediaWorker } from './queues';
import { processEventsJob } from './services/message-processor.service';
import { processMediaJob } from './services/media-downloader.service';

const logger = createLogger('whatsapp-logger');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4001', 10);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-logger' });
});

app.use('/webhook', webhookRouter);

// Start BullMQ workers
const eventsWorker = createEventsWorker(processEventsJob);
const mediaWorker = createMediaWorker(processMediaJob);

eventsWorker.on('completed', (job) => {
  logger.debug('Event job completed', { jobId: job.id, name: job.name });
});

eventsWorker.on('failed', (job, err) => {
  logger.error('Event job failed', { jobId: job?.id, error: err.message });
});

mediaWorker.on('failed', (job, err) => {
  logger.error('Media job failed', { jobId: job?.id, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('WhatsApp Logger started', { port: PORT });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing workers');
  await Promise.all([eventsWorker.close(), mediaWorker.close()]);
  process.exit(0);
});
