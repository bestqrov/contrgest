import { Router, Request, Response } from 'express';
import { prisma } from '@field-ops/db';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'api', db: 'unreachable' });
  }
});
