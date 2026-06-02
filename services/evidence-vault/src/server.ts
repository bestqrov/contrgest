import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { uploadRouter } from './routes/upload.routes';
import { internalRouter } from './routes/internal.routes';
import { serveRouter } from './routes/serve.routes';

const logger = createLogger('evidence-vault');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4003', 10);

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'evidence-vault' }));

app.use('/upload', uploadRouter);
app.use('/internal', internalRouter);
app.use('/files', serveRouter);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Evidence Vault started', { port: PORT });
});

process.on('SIGTERM', () => process.exit(0));
