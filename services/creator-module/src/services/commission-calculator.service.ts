import { prisma } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('creator-module:commission-calculator');

class CommissionCalculator {
  async calculateCurrentMonth(): Promise<void> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    logger.info('Calculating commissions', { period });

    const creators = await prisma.creator.findMany({ where: { status: 'ACTIVE' } });

    for (const creator of creators) {
      // Skip if commission already calculated for this period
      const existing = await prisma.commission.findFirst({
        where: { creatorId: creator.id, period },
      });
      if (existing) continue;

      // Count approved submissions this month
      const approvedSubmissions = await prisma.contentSubmission.findMany({
        where: {
          creatorId: creator.id,
          status: 'APPROVED',
          reviewedAt: { gte: monthStart, lte: monthEnd },
        },
        select: { id: true, viewCount: true, likeCount: true, shareCount: true },
      });

      if (approvedSubmissions.length === 0) continue;

      // Base commission: rate per approved submission
      const rate = Number(creator.commissionRate);
      const baseAmountPerContent = 500; // MAD base — adjust per business rules
      const baseAmount = approvedSubmissions.length * baseAmountPerContent;

      // Engagement bonus: 10 MAD per 1000 views
      let bonusAmount = 0;
      for (const s of approvedSubmissions) {
        if (s.viewCount) {
          bonusAmount += Math.floor(Number(s.viewCount) / 1000) * 10;
        }
      }

      const totalAmount = baseAmount * (rate / 100) + bonusAmount;

      await prisma.commission.create({
        data: {
          creatorId: creator.id,
          period,
          baseAmount: baseAmount.toString(),
          bonusAmount: bonusAmount.toString(),
          totalAmount: totalAmount.toString(),
          currency: 'MAD',
          lines: {
            create: approvedSubmissions.map((s) => ({
              contentSubmissionId: s.id,
              description: `Approved content commission`,
              amount: ((baseAmountPerContent * rate) / 100).toString(),
              metric: 'views',
              metricValue: s.viewCount ?? 0n,
            })),
          },
        },
      });

      // Update creator total earnings
      await prisma.creator.update({
        where: { id: creator.id },
        data: { totalEarnings: { increment: totalAmount } },
      });

      logger.info('Commission calculated', {
        creatorId: creator.id,
        period,
        total: totalAmount,
        submissions: approvedSubmissions.length,
      });
    }
  }
}

// Add approvedAt to schema by extending update timestamps
declare module '@field-ops/db' {
  // We use reviewedAt as proxy for approvedAt
}

export const commissionCalculator = new CommissionCalculator();
