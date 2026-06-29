import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, ContractType } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const contractRouter: Router = Router();
contractRouter.use(authenticate, requireRole('ADMIN'));

const getParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const createContractSchema = z.object({
  contractNumber: z.string().min(1),
  employeeId: z.string(),
  type: z.nativeEnum(ContractType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  salary: z.number().positive(),
  currency: z.string().default('MAD'),
  terms: z.string().optional(),
  fileUrl: z.string().url().optional(),
});

contractRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const where = req.query.employeeId ? { employeeId: req.query.employeeId as string } : {};

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take,
        orderBy: { startDate: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.contract.count({ where }),
    ]);

    res.json({ success: true, data: contracts, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

contractRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createContractSchema.parse(req.body);

    const existing = await prisma.contract.findUnique({ where: { contractNumber: body.contractNumber } });
    if (existing) throw new AppError(409, ERROR_CODES.ALREADY_EXISTS, 'Contract number already exists');

    const contract = await prisma.contract.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });

    res.status(201).json({ success: true, data: contract });
  } catch (err) {
    next(err);
  }
});

contractRouter.patch('/:id/sign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contractId = getParam(req.params.id as string | string[] | undefined);
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { isSigned: true, signedAt: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
