import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, ContentStatus } from '@field-ops/db';
import { sha256Hex, createLogger } from '@field-ops/shared';
import axios from 'axios';

const logger = createLogger('content-guard:submission');
export const submissionRouter: Router = Router();

const MAX_MB = parseInt(process.env.MAX_CONTENT_FILE_SIZE_MB ?? '500', 10);
const ALLOWED_MIMES = (process.env.ALLOWED_CONTENT_MIME_TYPES ?? 'video/mp4,image/jpeg,image/png,image/webp').split(',').map((s) => s.trim());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`MIME type ${file.mimetype} not allowed`));
    }
  },
});

const submitSchema = z.object({
  creatorId: z.string(),
  platform: z.enum(['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'OTHER']),
  contentType: z.enum(['VIDEO', 'IMAGE', 'STORY', 'REEL']),
  title: z.string().optional(),
  description: z.string().optional(),
  durationSeconds: z.coerce.number().optional(),
});

const contentStatusQuerySchema = z.nativeEnum(ContentStatus);

submissionRouter.post('/', upload.single('content'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No content file provided' });
      return;
    }

    const body = submitSchema.parse(req.body);

    const creator = await prisma.creator.findUnique({ where: { id: body.creatorId } });
    if (!creator) {
      res.status(404).json({ success: false, error: 'Creator not found' });
      return;
    }

    const fileHash = sha256Hex(req.file.buffer);

    // Archive to evidence vault
    const vaultUrl = process.env.EVIDENCE_VAULT_INTERNAL_URL;
    const submissionNumber = `CONTENT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Create submission record first (need ID for vault link)
    const submission = await prisma.contentSubmission.create({
      data: {
        submissionNumber,
        creatorId: body.creatorId,
        platform: body.platform,
        contentType: body.contentType,
        title: body.title,
        description: body.description,
        durationSeconds: body.durationSeconds,
        fileUrl: 'pending',
        fileHash,
        status: 'PENDING',
      },
    });

    let fileUrl = 'local';
    if (vaultUrl) {
      try {
        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);
        formData.append('linkedType', 'content_submission');
        formData.append('linkedId', submission.id);

        const vaultResp = await axios.post(`${vaultUrl}/upload`, formData, {
          headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET },
          timeout: 120_000,
          maxBodyLength: MAX_MB * 1024 * 1024,
        });

        fileUrl = vaultResp.data?.data?.storagePath ?? 'vault';
      } catch (err) {
        logger.warn('Vault archival failed, continuing', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    await prisma.contentSubmission.update({
      where: { id: submission.id },
      data: { fileUrl },
    });

    // Notify alert engine to push WhatsApp notification to owner
    const alertUrl = process.env.ALERT_ENGINE_INTERNAL_URL;
    if (alertUrl) {
      await axios.post(`${alertUrl}/internal/notify`, {
        type: 'CONTENT_SUBMITTED',
        employeeId: creator.employeeId,
        submissionId: submission.id,
        platform: body.platform,
        creatorName: `${creator.firstName} ${creator.lastName}`,
      }, {
        headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET },
        timeout: 5000,
      }).catch(() => null);
    }

    logger.info('Content submitted', { id: submission.id, creator: body.creatorId, platform: body.platform });
    res.status(201).json({ success: true, data: { id: submission.id, status: 'PENDING', hash: fileHash } });
  } catch (err) {
    logger.error('Submission failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Submission failed' });
  }
});

submissionRouter.get('/', async (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SERVICE_SECRET) {
    const creatorId = Array.isArray(req.query.creatorId)
      ? req.query.creatorId[0]
      : req.query.creatorId;
    if (!creatorId) {
      res.status(400).json({ error: 'creatorId required' });
      return;
    }

    const submissions = await prisma.contentSubmission.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: submissions });
    return;
  }

  const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const parsedStatus = rawStatus ? contentStatusQuerySchema.safeParse(rawStatus) : null;

  const submissions = await prisma.contentSubmission.findMany({
    where: parsedStatus?.success ? { status: parsedStatus.data } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { creator: { select: { firstName: true, lastName: true } } },
  });
  res.json({ success: true, data: submissions });
});
