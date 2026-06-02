import { Router, Request, Response } from 'express';
import { prisma } from '@field-ops/db';

export const statsRouter = Router();

statsRouter.get('/leaderboard', async (_req: Request, res: Response) => {
  const creators = await prisma.creator.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: { select: { submissions: true } },
    },
    orderBy: { totalEarnings: 'desc' },
    take: 10,
  });

  const leaderboard = creators.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    tiktokHandle: c.tiktokHandle,
    totalEarnings: c.totalEarnings,
    submissionsCount: c._count.submissions,
  }));

  _res.json({ success: true, data: leaderboard });
});

statsRouter.get('/overview', async (_req: Request, res: Response) => {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [totalCreators, pendingSubmissions, approvedThisMonth, totalCommissionsPaid] = await Promise.all([
    prisma.creator.count({ where: { status: 'ACTIVE' } }),
    prisma.contentSubmission.count({ where: { status: 'PENDING' } }),
    prisma.contentSubmission.count({ where: { status: 'APPROVED', reviewedAt: { gte: monthStart } } }),
    prisma.commission.aggregate({ where: { isPaid: true }, _sum: { totalAmount: true } }),
  ]);

  res.json({
    success: true,
    data: {
      totalCreators,
      pendingSubmissions,
      approvedThisMonth,
      totalCommissionsPaid: totalCommissionsPaid._sum.totalAmount ?? 0,
    },
  });
});
