import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, AlertStatus, AlertType, AlertSeverity } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const alertRouter: Router = Router();
alertRouter.use(authenticate, requireRole('ADMIN'));

const getParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

alertRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);

    const status = getParam(req.query.status as string | string[] | undefined);
    const severity = getParam(req.query.severity as string | string[] | undefined);
    const type = getParam(req.query.type as string | string[] | undefined);
    const employeeId = getParam(req.query.employeeId as string | string[] | undefined);

    const where = {
      ...(status ? { status: status as AlertStatus } : { status: { not: AlertStatus.DISMISSED } }),
      ...(severity ? { severity: severity as AlertSeverity } : {}),
      ...(type ? { type: type as AlertType } : {}),
      ...(employeeId ? { employeeId } : {}),
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
    const alertId = getParam(req.params.id as string | string[] | undefined);
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Alert not found');

    const updated = await prisma.alert.update({
      where: { id: alertId },
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
    const alertId = getParam(req.params.id as string | string[] | undefined);

    const updated = await prisma.alert.update({
      where: { id: alertId },
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
