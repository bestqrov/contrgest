import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { createLogger } from '@field-ops/shared';
import { errorHandler } from './middleware/error.middleware';
import { authRouter } from './routes/auth.routes';
import { employeeRouter } from './routes/employee.routes';
import { deviceRouter } from './routes/device.routes';
import { salesRouter } from './routes/sales.routes';
import { gpsRouter } from './routes/gps.routes';
import { alertRouter } from './routes/alert.routes';
import { contractRouter } from './routes/contract.routes';
import { violationRouter } from './routes/violation.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { healthRouter } from './routes/health.routes';
import { rateLimiter } from './middleware/rate-limit.middleware';

const logger = createLogger('api');
const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: true, crossOriginEmbedderPolicy: true }));
app.use(cors({
  origin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

app.use('/health', healthRouter);
app.use('/api/v1/auth', rateLimiter({ windowMs: 15 * 60_000, max: 20 }), authRouter);
app.use('/api/v1/employees', employeeRouter);
app.use('/api/v1/devices', deviceRouter);
app.use('/api/v1/sales', salesRouter);
app.use('/api/v1/gps', gpsRouter);
app.use('/api/v1/alerts', alertRouter);
app.use('/api/v1/contracts', contractRouter);
app.use('/api/v1/violations', violationRouter);
app.use('/api/v1/dashboard', dashboardRouter);

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`API service started`, { port: PORT, env: process.env.NODE_ENV });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  process.exit(0);
});

export default app;
