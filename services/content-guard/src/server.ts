import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { submissionRouter } from './routes/submission.routes';
import { reviewRouter } from './routes/review.routes';

const logger = createLogger('content-guard');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4002', 10);

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'content-guard' }));
app.use('/submissions', submissionRouter);
app.use('/review', reviewRouter);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Content Guard started', { port: PORT });
});

process.on('SIGTERM', () => process.exit(0));
