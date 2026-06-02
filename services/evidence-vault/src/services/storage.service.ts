import mime from 'mime-types';
import { extname } from 'path';
import axios from 'axios';
import {
  uploadBuffer as minioUpload,
  objectExists,
  evidenceKey,
  EVIDENCE_BUCKET,
  sha256Hex,
  createLogger,
} from '@field-ops/shared';
import { prisma } from '@field-ops/db';

const logger = createLogger('evidence-vault:storage');
const MAX_SIZE_BYTES = parseInt(process.env.EVIDENCE_MAX_FILE_SIZE_MB ?? '1024', 10) * 1024 * 1024;

export interface ArchiveResult {
  id: string;
  sha256Hash: string;
  storagePath: string;
  sizeBytes: bigint;
  url: string;
}

type LinkedTo =
  | { type: 'message'; id: string }
  | { type: 'sale'; id: string }
  | { type: 'content_submission'; id: string };

class StorageService {
  async archiveBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    linkedTo: LinkedTo,
    uploadedBy?: string,
  ): Promise<ArchiveResult> {
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error(`File exceeds max size of ${process.env.EVIDENCE_MAX_FILE_SIZE_MB}MB`);
    }

    const hash = sha256Hex(buffer);

    // SHA-256 dedup — same content → same record
    const existing = await prisma.evidenceFile.findUnique({ where: { sha256Hash: hash } });
    if (existing) {
      logger.debug('Dedup: returning existing evidence record', { id: existing.id, hash });
      return {
        id: existing.id,
        sha256Hash: hash,
        storagePath: existing.storagePath,
        sizeBytes: existing.sizeBytes,
        url: `${process.env.EVIDENCE_VAULT_INTERNAL_URL ?? 'http://evidence-vault:4003'}/files/${existing.id}`,
      };
    }

    const ext = extname(originalName).replace('.', '') || mime.extension(mimeType) || 'bin';
    const category = linkedTo.type.replace('_', '-');
    const key = evidenceKey(category, new Date(), hash, ext);

    const uploadResult = await minioUpload(EVIDENCE_BUCKET, key, buffer, mimeType, {
      linkedType: linkedTo.type,
      linkedId: linkedTo.id,
      originalName,
    });

    const record = await prisma.evidenceFile.create({
      data: {
        fileName: key.split('/').pop()!,
        originalName,
        mimeType,
        sizeBytes: BigInt(buffer.length),
        sha256Hash: hash,
        storagePath: key,
        storageProvider: 'minio',
        bucketName: EVIDENCE_BUCKET,
        uploadedBy,
        ...(linkedTo.type === 'message' ? { messageId: linkedTo.id } : {}),
        ...(linkedTo.type === 'sale' ? { saleId: linkedTo.id } : {}),
        ...(linkedTo.type === 'content_submission' ? { contentSubmissionId: linkedTo.id } : {}),
      },
    });

    logger.info('Evidence archived to MinIO', {
      id: record.id,
      hash,
      size: buffer.length,
      key,
      type: linkedTo.type,
    });

    return {
      id: record.id,
      sha256Hash: hash,
      storagePath: key,
      sizeBytes: BigInt(buffer.length),
      url: uploadResult.url,
    };
  }

  async archiveFromUrl(
    url: string,
    linkedTo: LinkedTo,
    mimeHint?: string,
  ): Promise<ArchiveResult | null> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: MAX_SIZE_BYTES,
      });

      const buffer = Buffer.from(response.data);
      const contentType = (response.headers['content-type'] as string | undefined) ?? mimeHint ?? 'application/octet-stream';
      const ext = mime.extension(contentType) || 'bin';
      const originalName = `download.${ext}`;

      return this.archiveBuffer(buffer, originalName, contentType, linkedTo);
    } catch (err) {
      logger.error('Failed to archive from URL', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async verifyIntegrity(evidenceFileId: string): Promise<{ valid: boolean; storedHash: string }> {
    const record = await prisma.evidenceFile.findUnique({ where: { id: evidenceFileId } });
    if (!record) return { valid: false, storedHash: '' };

    const exists = await objectExists(EVIDENCE_BUCKET, record.storagePath);
    return { valid: exists, storedHash: record.sha256Hash };
  }
}

export const storageService = new StorageService();
