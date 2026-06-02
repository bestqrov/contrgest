import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { enrollmentRouter } from './routes/enrollment.routes';
import { policyRouter } from './routes/policy.routes';
import { deviceSyncRouter } from './routes/device-sync.routes';
import { policySyncJob } from './services/policy-sync.service';

const logger = createLogger('mdm-service');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4005', 10);

app.use(helmet());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'mdm-service' }));
app.use('/enrollment', enrollmentRouter);
app.use('/policies', policyRouter);
app.use('/devices', deviceSyncRouter);

const SYNC_INTERVAL = parseInt(process.env.MDM_POLICY_UPDATE_INTERVAL_MS ?? '300000', 10);
setInterval(() => {
  policySyncJob.run().catch((e) => logger.error('Policy sync failed', { error: e.message }));
}, SYNC_INTERVAL);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('MDM Service started', { port: PORT });
});

process.on('SIGTERM', () => process.exit(0));
