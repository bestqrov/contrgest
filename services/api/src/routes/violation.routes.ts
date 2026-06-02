import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, ViolationType, AlertSeverity } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { parsePagination, buildMeta } from '@field-ops/shared';

export const violationRouter = Router();
violationRouter.use(authenticate, requireRole('ADMIN'));

const createViolationSchema = z.object({
  employeeId: z.string(),
  type: z.nativeEnum(ViolationType),
  severity: z.nativeEnum(AlertSeverity),
  description: z.string().min(1),
  evidence: z.string().optional(),
  occurredAt: z.string().datetime(),
});

violationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const where = req.query.employeeId ? { employeeId: req.query.employeeId as string } : {};

    const [violations, total] = await Promise.all([
      prisma.violation.findMany({
        where,
        skip,
        take,
        orderBy: { occurredAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.violation.count({ where }),
    ]);

    res.json({ success: true, data: violations, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

violationRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createViolationSchema.parse(req.body);

    const violation = await prisma.violation.create({
      data: {
        ...body,
        reportedBy: req.employee!.id,
        occurredAt: new Date(body.occurredAt),
      },
    });

    res.status(201).json({ success: true, data: violation });
  } catch (err) {
    next(err);
  }
});
