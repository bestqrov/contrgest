import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, ContentStatus } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('content-guard:review');
export const reviewRouter = Router();

// Admin-only review endpoint — protected by internal secret
reviewRouter.use((req: Request, res: Response, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

const reviewSchema = z.object({
  status: z.nativeEnum(ContentStatus),
  reviewedBy: z.string(),
  reviewNotes: z.string().optional(),
  publishedUrl: z.string().url().optional(),
});

reviewRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const body = reviewSchema.parse(req.body);

    const submission = await prisma.contentSubmission.findUnique({ where: { id: req.params.id } });
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    const updated = await prisma.contentSubmission.update({
      where: { id: req.params.id },
      data: {
        status: body.status,
        reviewedBy: body.reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: body.reviewNotes,
        publishedUrl: body.publishedUrl,
        publishedAt: body.status === ContentStatus.APPROVED && body.publishedUrl ? new Date() : undefined,
      },
    });

    logger.info('Content reviewed', { id: req.params.id, status: body.status, by: body.reviewedBy });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('Review failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Review failed' });
  }
});
