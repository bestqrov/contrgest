import express from 'express';
import helmet from 'helmet';
import { createLogger } from '@field-ops/shared';
import { creatorRouter } from './routes/creator.routes';
import { commissionRouter } from './routes/commission.routes';
import { statsRouter } from './routes/stats.routes';
import { commissionCalculator } from './services/commission-calculator.service';

const logger = createLogger('creator-module');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4007', 10);

app.use(helmet());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'creator-module' }));
app.use('/creators', creatorRouter);
app.use('/commissions', commissionRouter);
app.use('/stats', statsRouter);

// Schedule commission calculation on the configured day of month
const CALC_DAY = parseInt(process.env.CREATOR_COMMISSION_CALCULATION_DAY ?? '28', 10);
setInterval(() => {
  const today = new Date().getDate();
  if (today === CALC_DAY) {
    commissionCalculator.calculateCurrentMonth().catch((e) =>
      logger.error('Commission calculation failed', { error: e.message }),
    );
  }
}, 24 * 60 * 60 * 1000); // Check daily

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Creator Module started', { port: PORT });
});

process.on('SIGTERM', () => process.exit(0));
