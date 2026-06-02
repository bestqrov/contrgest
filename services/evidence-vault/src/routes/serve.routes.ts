import { Router, Request, Response, IRouter } from 'express';
import { prisma } from '@field-ops/db';
import { getPresignedUrl, EVIDENCE_BUCKET } from '@field-ops/shared';

export const serveRouter: IRouter = Router();

// Returns a short-lived presigned MinIO URL for the file
serveRouter.get('/:id', async (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'] ?? req.query.token;
  if (secret !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const file = await prisma.evidenceFile.findUnique({ where: { id: String(req.params.id) } });
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const url = await getPresignedUrl(EVIDENCE_BUCKET, file.storagePath, 3600);

  res.json({
    success: true,
    data: {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sha256Hash: file.sha256Hash,
      sizeBytes: file.sizeBytes.toString(),
      presignedUrl: url,
      expiresIn: 3600,
    },
  });
});
