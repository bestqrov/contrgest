import { Router, Request, Response, NextFunction } from 'express';
import { prisma, AlertStatus, EmployeeStatus } from '@field-ops/db';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requireRole('ADMIN'));

dashboardRouter.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      activeEmployees,
      todaySales,
      monthSales,
      openAlerts,
      criticalAlerts,
      devicesOnline,
      devicesTotal,
      pendingContent,
      flaggedMessages,
    ] = await Promise.all([
      prisma.employee.count({ where: { status: EmployeeStatus.ACTIVE } }),
      prisma.sale.aggregate({ where: { saleDate: { gte: today } }, _sum: { amount: true }, _count: { id: true } }),
      prisma.sale.aggregate({ where: { saleDate: { gte: monthStart } }, _sum: { amount: true }, _count: { id: true } }),
      prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
      prisma.alert.count({ where: { status: AlertStatus.OPEN, severity: 'CRITICAL' } }),
      prisma.device.count({ where: { status: 'ACTIVE', lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) } } }),
      prisma.device.count({ where: { status: 'ACTIVE' } }),
      prisma.contentSubmission.count({ where: { status: 'PENDING' } }),
      prisma.message.count({ where: { isFlagged: true, createdAt: { gte: today } } }),
    ]);

    res.json({
      success: true,
      data: {
        employees: { active: activeEmployees },
        sales: {
          today: { amount: todaySales._sum.amount ?? 0, count: todaySales._count.id },
          month: { amount: monthSales._sum.amount ?? 0, count: monthSales._count.id },
        },
        alerts: { open: openAlerts, critical: criticalAlerts },
        devices: { online: devicesOnline, total: devicesTotal },
        content: { pending: pendingContent },
        messages: { flaggedToday: flaggedMessages },
      },
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/activity-feed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string ?? '20', 10));

    const [recentSales, recentAlerts, recentViolations] = await Promise.all([
      prisma.sale.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { firstName: true, lastName: true } } },
        select: { id: true, saleNumber: true, amount: true, currency: true, saleDate: true, createdAt: true, clientName: true, employee: true },
      }),
      prisma.alert.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, severity: true, title: true, createdAt: true, status: true },
      }),
      prisma.violation.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { firstName: true, lastName: true } } },
        select: { id: true, type: true, severity: true, description: true, occurredAt: true, createdAt: true, employee: true },
      }),
    ]);

    const feed = [
      ...recentSales.map((s) => ({ kind: 'sale' as const, ts: s.createdAt, data: s })),
      ...recentAlerts.map((a) => ({ kind: 'alert' as const, ts: a.createdAt, data: a })),
      ...recentViolations.map((v) => ({ kind: 'violation' as const, ts: v.createdAt, data: v })),
    ]
      .sort((a, b) => b.ts.getTime() - a.ts.getTime())
      .slice(0, limit);

    res.json({ success: true, data: feed });
  } catch (err) {
    next(err);
  }
});
