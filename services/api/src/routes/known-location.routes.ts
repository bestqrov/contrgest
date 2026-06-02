import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, KnownLocationType } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { ERROR_CODES } from '@field-ops/shared';

export const knownLocationRouter = Router();
knownLocationRouter.use(authenticate, requireRole('ADMIN'));

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(KnownLocationType),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000).default(100),
  employeeIds: z.array(z.string()).default([]),
});

knownLocationRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const locations = await prisma.knownLocation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
});

knownLocationRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const location = await prisma.knownLocation.create({
      data: {
        ...body,
        latitude: body.latitude.toString(),
        longitude: body.longitude.toString(),
        createdBy: (req as any).user?.id,
      },
    });
    res.status(201).json({ success: true, data: location });
  } catch (err) {
    next(err);
  }
});

knownLocationRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.knownLocation.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Location not found');

    const body = createSchema.partial().parse(req.body);
    const updated = await prisma.knownLocation.update({
      where: { id: String(req.params.id) },
      data: {
        ...body,
        ...(body.latitude !== undefined ? { latitude: body.latitude.toString() } : {}),
        ...(body.longitude !== undefined ? { longitude: body.longitude.toString() } : {}),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

knownLocationRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.knownLocation.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Location not found');

    await prisma.knownLocation.update({ where: { id: String(req.params.id) }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
