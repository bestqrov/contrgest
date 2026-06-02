import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { anomalyDetector } from './services/anomaly-detector.service';
import { geofenceChecker } from './services/geofence-checker.service';

const logger = createLogger('gps-engine');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4004', 10);

app.use(helmet());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gps-engine' }));

// Start background jobs
const ANOMALY_INTERVAL = parseInt(process.env.GPS_BATCH_INTERVAL_MS ?? '30000', 10);
const GEOFENCE_INTERVAL = parseInt(process.env.GPS_GEOFENCE_CHECK_INTERVAL_MS ?? '60000', 10);

setInterval(() => {
  anomalyDetector.runCheck().catch((err) =>
    logger.error('Anomaly check failed', { error: err.message }),
  );
}, ANOMALY_INTERVAL);

setInterval(() => {
  geofenceChecker.runCheck().catch((err) =>
    logger.error('Geofence check failed', { error: err.message }),
  );
}, GEOFENCE_INTERVAL);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('GPS Engine started', { port: PORT });

  // Run immediately on start
  anomalyDetector.runCheck().catch(() => null);
  geofenceChecker.runCheck().catch(() => null);
});

process.on('SIGTERM', () => process.exit(0));
