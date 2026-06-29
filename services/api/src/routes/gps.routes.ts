import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildMeta, ERROR_CODES } from '@field-ops/shared';

export const gpsRouter: Router = Router();
gpsRouter.use(authenticate);

const getParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const trackSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  altitude: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.string().datetime(),
  batchId: z.string().optional(),
});

const batchTrackSchema = z.array(trackSchema).min(1).max(500);

// Mobile agent sends GPS batches
gpsRouter.post('/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.employee!.id },
      include: { device: true },
    });

    if (!employee?.device) {
      throw new AppError(400, ERROR_CODES.DEVICE_NOT_ENROLLED, 'No device assigned to this employee');
    }

    const points = Array.isArray(req.body) ? batchTrackSchema.parse(req.body) : [trackSchema.parse(req.body)];

    await prisma.gpsTrack.createMany({
      data: points.map((p) => ({
        employeeId: employee.id,
        deviceId: employee.device!.id,
        latitude: p.latitude.toString(),
        longitude: p.longitude.toString(),
        accuracy: p.accuracy,
        altitude: p.altitude,
        speed: p.speed,
        heading: p.heading,
        timestamp: new Date(p.timestamp),
        batchId: p.batchId,
      })),
      skipDuplicates: true,
    });

    // Update device last seen
    await prisma.device.update({
      where: { id: employee.device.id },
      data: { lastSeenAt: new Date() },
    });

    res.json({ success: true, data: { received: points.length } });
  } catch (err) {
    next(err);
  }
});

// Admin: get track history
gpsRouter.get('/history/:employeeId', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);
    const employeeId = getParam(req.params.employeeId as string | string[] | undefined);
    const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const until = req.query.until ? new Date(req.query.until as string) : new Date();

    const [tracks, total] = await Promise.all([
      prisma.gpsTrack.findMany({
        where: { employeeId, timestamp: { gte: since, lte: until } },
        skip,
        take,
        orderBy: { timestamp: 'asc' },
      }),
      prisma.gpsTrack.count({ where: { employeeId, timestamp: { gte: since, lte: until } } }),
    ]);

    res.json({ success: true, data: tracks, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

// Admin: live positions (last known location per employee)
gpsRouter.get('/live', requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        zone: true,
        gpsTracks: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    const live = employees.map((e) => ({
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`,
      role: e.role,
      zone: e.zone,
      lastLocation: e.gpsTracks[0] ?? null,
    }));

    res.json({ success: true, data: live });
  } catch (err) {
    next(err);
  }
});

// Admin: anomalies
gpsRouter.get('/anomalies', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = parsePagination(req.query);

    const [anomalies, total] = await Promise.all([
      prisma.gpsTrack.findMany({
        where: { isAnomaly: true },
        skip,
        take,
        orderBy: { timestamp: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.gpsTrack.count({ where: { isAnomaly: true } }),
    ]);

    res.json({ success: true, data: anomalies, meta: buildMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});
