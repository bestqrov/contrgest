import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { internalRouter } from './routes/internal.routes';
import { escalationChecker } from './services/escalation.service';
import { contractExpiryChecker } from './services/contract-expiry.service';
import { deviceOfflineChecker } from './services/device-offline.service';

const logger = createLogger('alert-engine');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4006', 10);

app.use(helmet());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'alert-engine' }));
app.use('/internal', internalRouter);

const CHECK_INTERVAL = parseInt(process.env.ALERT_CHECK_INTERVAL_MS ?? '60000', 10);

setInterval(() => {
  escalationChecker.run().catch((e) => logger.error('Escalation check failed', { error: e.message }));
  contractExpiryChecker.run().catch((e) => logger.error('Contract expiry check failed', { error: e.message }));
  deviceOfflineChecker.run().catch((e) => logger.error('Device offline check failed', { error: e.message }));
}, CHECK_INTERVAL);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Alert Engine started', { port: PORT });
});

process.on('SIGTERM', () => process.exit(0));
