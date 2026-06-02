import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const salesRouter = Router();
salesRouter.use(authenticate);

const createSaleSchema = z.object({
  saleNumber: z.string().min(1),
  clientName: z.string().min(1),
  clientPhone: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('MAD'),
  productLine: z.string().optional(),
  description: z.string().optional(),
  saleDate: z.string().datetime(),
  deliveryDate: z.string().datetime().optional(),
  paymentMethod: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().optional(),
});

salesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const isAdmin = req.employee!.role === 'ADMIN';

    const where = {
      ...(isAdmin ? {} : { employeeId: req.employee!.id }),
      ...(req.query.employeeId ? { employeeId: req.query.employeeId as string } : {}),
      ...(req.query.isPaid !== undefined ? { isPaid: req.query.isPaid === 'true' } : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take,
        orderBy: { saleDate: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({ success: true, data: sales, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

salesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSaleSchema.parse(req.body);
    const employeeId = req.employee!.role === 'ADMIN'
      ? (req.body.employeeId ?? req.employee!.id)
      : req.employee!.id;

    const existing = await prisma.sale.findUnique({ where: { saleNumber: body.saleNumber } });
    if (existing) {
      throw new AppError(409, ERROR_CODES.ALREADY_EXISTS, 'Sale number already exists');
    }

    const sale = await prisma.sale.create({
      data: {
        ...body,
        employeeId,
        saleDate: new Date(body.saleDate),
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : undefined,
        amount: body.amount,
        latitude: body.latitude?.toString(),
        longitude: body.longitude?.toString(),
      },
    });

    res.status(201).json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
});

salesRouter.patch('/:id/paid', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
    if (!sale) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Sale not found');

    const updated = await prisma.sale.update({
      where: { id: req.params.id },
      data: { isPaid: true, paymentDate: new Date(), paymentMethod: req.body.paymentMethod },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

salesRouter.get('/summary', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string ?? '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byEmployee, totals] = await Promise.all([
      prisma.sale.groupBy({
        by: ['employeeId'],
        where: { saleDate: { gte: since } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.sale.aggregate({
        where: { saleDate: { gte: since } },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        period: `${days}d`,
        total: { amount: totals._sum.amount ?? 0, count: totals._count.id },
        byEmployee,
      },
    });
  } catch (err) {
    next(err);
  }
});
