import { Router, Request, Response, IRouter } from 'express';
import { storageService } from '../services/storage.service';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('evidence-vault:internal');
export const internalRouter: IRouter = Router();

internalRouter.use((req: Request, res: Response, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

internalRouter.post('/archive-from-url', async (req: Request, res: Response) => {
  try {
    const { url, linkedTo, mimeHint } = req.body as {
      url: string;
      linkedTo: { type: 'message' | 'sale' | 'content_submission'; id: string };
      mimeHint?: string;
    };

    if (!url || !linkedTo?.type || !linkedTo?.id) {
      res.status(400).json({ error: 'url and linkedTo required' });
      return;
    }

    const result = await storageService.archiveFromUrl(url, linkedTo, mimeHint);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Archive from URL failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Archive failed' });
  }
});

internalRouter.get('/verify/:id', async (req: Request, res: Response) => {
  try {
    const result = await storageService.verifyIntegrity(String(req.params.id));
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Integrity check failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Verification failed' });
  }
});
