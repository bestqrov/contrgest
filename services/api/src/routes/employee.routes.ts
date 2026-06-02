import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, EmployeeRole, EmployeeStatus } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const employeeRouter = Router();
employeeRouter.use(authenticate);

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(10),
  whatsappJid: z.string().optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(EmployeeRole),
  hireDate: z.string().datetime(),
  zone: z.string().optional(),
  targetZone: z.string().optional(),
  managerId: z.string().optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.nativeEnum(EmployeeStatus).optional(),
  terminationDate: z.string().datetime().optional(),
});

employeeRouter.get('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const search = req.query.search as string | undefined;
    const role = req.query.role as EmployeeRole | undefined;
    const status = req.query.status as EmployeeStatus | undefined;
    const zone = req.query.zone as string | undefined;

    const where = {
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { employeeNumber: { contains: search } },
        ],
      } : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(zone ? { zone } : {}),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { device: { select: { id: true, model: true, status: true, lastSeenAt: true } } },
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({
      success: true,
      data: employees,
      meta: buildMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
});

employeeRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        device: true,
        contracts: { orderBy: { startDate: 'desc' }, take: 1 },
        _count: { select: { sales: true, violations: true, messages: true } },
      },
    });

    if (!employee) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Employee not found');
    }

    // Non-admin can only view their own profile
    if (req.employee!.role !== 'ADMIN' && req.employee!.id !== employee.id) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Access denied');
    }

    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
});

employeeRouter.post('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createEmployeeSchema.parse(req.body);

    const existing = await prisma.employee.findFirst({
      where: { OR: [{ phone: body.phone }, { employeeNumber: body.employeeNumber }] },
    });
    if (existing) {
      throw new AppError(409, ERROR_CODES.ALREADY_EXISTS, 'Employee with this phone or number already exists');
    }

    const employee = await prisma.employee.create({
      data: { ...body, hireDate: new Date(body.hireDate) },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.employee!.id,
        actorType: 'EMPLOYEE',
        action: 'CREATE',
        resource: 'Employee',
        resourceId: employee.id,
        newValue: body,
      },
    });

    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
});

employeeRouter.patch('/:id', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateEmployeeSchema.parse(req.body);

    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Employee not found');
    }

    const data: Record<string, unknown> = { ...body };
    if (body.hireDate) data.hireDate = new Date(body.hireDate);
    if (body.terminationDate) data.terminationDate = new Date(body.terminationDate);

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.employee!.id,
        actorType: 'EMPLOYEE',
        action: 'UPDATE',
        resource: 'Employee',
        resourceId: req.params.id,
        oldValue: existing,
        newValue: body,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

employeeRouter.get('/:id/stats', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    const [salesCount, salesTotal, messageCount, violationCount, lastTrack] = await Promise.all([
      prisma.sale.count({ where: { employeeId: id, saleDate: { gte: since } } }),
      prisma.sale.aggregate({ where: { employeeId: id, saleDate: { gte: since } }, _sum: { amount: true } }),
      prisma.message.count({ where: { employeeId: id, timestamp: { gte: since } } }),
      prisma.violation.count({ where: { employeeId: id, occurredAt: { gte: since } } }),
      prisma.gpsTrack.findFirst({ where: { employeeId: id }, orderBy: { timestamp: 'desc' } }),
    ]);

    res.json({
      success: true,
      data: {
        period: '30d',
        sales: { count: salesCount, total: salesTotal._sum.amount ?? 0 },
        messages: messageCount,
        violations: violationCount,
        lastLocation: lastTrack ? { lat: lastTrack.latitude, lon: lastTrack.longitude, at: lastTrack.timestamp } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});
