import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, AlertStatus } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const alertRouter = Router();
alertRouter.use(authenticate, requireRole('ADMIN'));

alertRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = {
      ...(req.query.status ? { status: req.query.status as AlertStatus } : { status: { not: 'DISMISSED' as AlertStatus } }),
      ...(req.query.severity ? { severity: req.query.severity as string } : {}),
      ...(req.query.type ? { type: req.query.type as string } : {}),
      ...(req.query.employeeId ? { employeeId: req.query.employeeId as string } : {}),
    };

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip,
        take,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.alert.count({ where }),
    ]);

    res.json({ success: true, data: alerts, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

alertRouter.patch('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
    if (!alert) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Alert not found');

    const updated = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: req.employee!.id,
        acknowledgedAt: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

alertRouter.patch('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resolutionNote } = z.object({ resolutionNote: z.string().optional() }).parse(req.body);

    const updated = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedBy: req.employee!.id,
        resolvedAt: new Date(),
        resolutionNote,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

alertRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [bySeverity, byType, openCount] = await Promise.all([
      prisma.alert.groupBy({
        by: ['severity'],
        where: { status: AlertStatus.OPEN },
        _count: { id: true },
      }),
      prisma.alert.groupBy({
        by: ['type'],
        where: { status: AlertStatus.OPEN },
        _count: { id: true },
      }),
      prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
    ]);

    res.json({ success: true, data: { openCount, bySeverity, byType } });
  } catch (err) {
    next(err);
  }
});
