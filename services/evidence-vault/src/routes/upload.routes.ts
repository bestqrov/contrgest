import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage.service';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('evidence-vault:upload');
export const uploadRouter = Router();

const MAX_MB = parseInt(process.env.EVIDENCE_MAX_FILE_SIZE_MB ?? '1024', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = (process.env.EVIDENCE_MAX_FILE_SIZE_MB ?? '')
      .split(',')
      .map((s) => s.trim());
    cb(null, true); // Allow all — callers are internal services
  },
});

uploadRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const { linkedType, linkedId, uploadedBy } = req.body as {
      linkedType?: 'message' | 'sale' | 'content_submission';
      linkedId?: string;
      uploadedBy?: string;
    };

    if (!linkedType || !linkedId) {
      res.status(400).json({ success: false, error: 'linkedType and linkedId required' });
      return;
    }

    const result = await storageService.archiveBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { type: linkedType, id: linkedId },
      uploadedBy,
    );

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Upload failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});
