import { Router, Request, Response } from 'express';
import { createReadStream } from 'fs';
import { prisma } from '@field-ops/db';
import { storageService } from '../services/storage.service';

export const serveRouter = Router();

// Serve evidence files by ID with auth check
serveRouter.get('/:id', async (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'] ?? req.query.token;
  if (secret !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const file = await prisma.evidenceFile.findUnique({ where: { id: req.params.id } });
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const absPath = storageService.getAbsolutePath(file.storagePath);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
  res.setHeader('X-SHA256', file.sha256Hash);

  const stream = createReadStream(absPath);
  stream.on('error', () => res.status(404).json({ error: 'File not accessible' }));
  stream.pipe(res);
});
