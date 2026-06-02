import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@field-ops/db';
import { parsePagination, buildMeta, createLogger } from '@field-ops/shared';

const logger = createLogger('creator-module:creators');
export const creatorRouter = Router();

const createCreatorSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  tiktokHandle: z.string().optional(),
  instagramHandle: z.string().optional(),
  youtubeHandle: z.string().optional(),
  commissionRate: z.number().min(0).max(100),
  employeeId: z.string().optional(),
});

creatorRouter.get('/', async (req: Request, res: Response) => {
  const { skip, take, page, limit } = parsePagination(req.query);

  const [creators, total] = await Promise.all([
    prisma.creator.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { submissions: true, commissions: true } },
      },
    }),
    prisma.creator.count(),
  ]);

  res.json({ success: true, data: creators, meta: buildMeta(total, page, limit) });
});

creatorRouter.get('/:id', async (req: Request, res: Response) => {
  const creator = await prisma.creator.findUnique({
    where: { id: req.params.id },
    include: {
      submissions: { orderBy: { createdAt: 'desc' }, take: 10 },
      commissions: { orderBy: { period: 'desc' }, take: 3 },
    },
  });

  if (!creator) {
    res.status(404).json({ error: 'Creator not found' });
    return;
  }

  res.json({ success: true, data: creator });
});

creatorRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = createCreatorSchema.parse(req.body);

    const creator = await prisma.creator.create({ data: { ...body, commissionRate: body.commissionRate.toString() } });
    logger.info('Creator created', { id: creator.id });
    res.status(201).json({ success: true, data: creator });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid input' });
  }
});
