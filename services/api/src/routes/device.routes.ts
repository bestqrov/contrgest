import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, DeviceStatus } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const deviceRouter: Router = Router();
deviceRouter.use(authenticate, requireRole('ADMIN'));

const getParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const createDeviceSchema = z.object({
  imei: z.string().length(15),
  serialNumber: z.string().min(1),
  model: z.string().min(1),
  androidVersion: z.string().min(1),
  employeeId: z.string().optional(),
});

const updateDeviceSchema = z.object({
  status: z.nativeEnum(DeviceStatus).optional(),
  employeeId: z.string().nullable().optional(),
  appVersion: z.string().optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  storageUsedMb: z.number().int().optional(),
});

deviceRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const status = req.query.status as DeviceStatus | undefined;

    const where = { ...(status ? { status } : {}) };

    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
      prisma.device.count({ where }),
    ]);

    res.json({ success: true, data: devices, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

deviceRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createDeviceSchema.parse(req.body);

    const existing = await prisma.device.findFirst({
      where: { OR: [{ imei: body.imei }, { serialNumber: body.serialNumber }] },
    });
    if (existing) {
      throw new AppError(409, ERROR_CODES.ALREADY_EXISTS, 'Device with this IMEI or serial number already exists');
    }

    if (body.employeeId) {
      const hasDevice = await prisma.device.findFirst({ where: { employeeId: body.employeeId } });
      if (hasDevice) {
        throw new AppError(409, ERROR_CODES.CONFLICT, 'Employee already has a device assigned');
      }
    }

    const device = await prisma.device.create({ data: body });
    res.status(201).json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
});

deviceRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateDeviceSchema.parse(req.body);
    const deviceId = getParam(req.params.id as string | string[] | undefined);

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Device not found');

    if (body.employeeId !== undefined && body.employeeId !== null) {
      const hasDevice = await prisma.device.findFirst({
        where: { employeeId: body.employeeId, NOT: { id: deviceId } },
      });
      if (hasDevice) {
        throw new AppError(409, ERROR_CODES.CONFLICT, 'Employee already has a device assigned');
      }
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: body,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Device heartbeat — called by MDM agent / mobile app
deviceRouter.post('/:id/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batteryLevel, storageUsedMb, appVersion, installedApps } = req.body;
    const deviceId = getParam(req.params.id as string | string[] | undefined);

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: new Date(),
        lastIp: req.ip,
        ...(batteryLevel !== undefined ? { batteryLevel } : {}),
        ...(storageUsedMb !== undefined ? { storageUsedMb } : {}),
        ...(appVersion ? { appVersion } : {}),
        ...(installedApps ? { installedApps } : {}),
      },
    });

    res.json({ success: true, data: { lastSeenAt: updated.lastSeenAt } });
  } catch (err) {
    next(err);
  }
});
