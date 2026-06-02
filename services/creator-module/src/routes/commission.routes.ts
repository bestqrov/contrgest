import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@field-ops/db';
import { parsePagination, buildMeta, createLogger } from '@field-ops/shared';
import { commissionCalculator } from '../services/commission-calculator.service';

const logger = createLogger('creator-module:commissions');
export const commissionRouter = Router();

commissionRouter.get('/', async (req: Request, res: Response) => {
  const { skip, take, page, limit } = parsePagination(req.query);
  const where = {
    ...(req.query.creatorId ? { creatorId: req.query.creatorId as string } : {}),
    ...(req.query.isPaid !== undefined ? { isPaid: req.query.isPaid === 'true' } : {}),
    ...(req.query.period ? { period: req.query.period as string } : {}),
  };

  const [commissions, total] = await Promise.all([
    prisma.commission.findMany({
      where,
      skip,
      take,
      orderBy: { period: 'desc' },
      include: { creator: { select: { firstName: true, lastName: true } } },
    }),
    prisma.commission.count({ where }),
  ]);

  res.json({ success: true, data: commissions, meta: buildMeta(total, page, limit) });
});

commissionRouter.post('/calculate', async (_req: Request, res: Response) => {
  if (_req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  commissionCalculator.calculateCurrentMonth().catch((e) =>
    logger.error('Manual calculation failed', { error: e.message }),
  );
  res.json({ success: true, message: 'Commission calculation triggered' });
});

commissionRouter.patch('/:id/pay', async (req: Request, res: Response) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { paymentRef } = z.object({ paymentRef: z.string().optional() }).parse(req.body);

  const updated = await prisma.commission.update({
    where: { id: req.params.id },
    data: { isPaid: true, paidAt: new Date(), paymentRef },
  });

  res.json({ success: true, data: updated });
});
