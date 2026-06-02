import { createReadStream, createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import { IncomingMessage } from 'http';
import axios from 'axios';
import mime from 'mime-types';
import { sha256File, sha256Hex, generateToken, createLogger } from '@field-ops/shared';
import { prisma } from '@field-ops/db';

const logger = createLogger('evidence-vault:storage');
const STORAGE_ROOT = process.env.EVIDENCE_STORAGE_PATH ?? '/data/evidence';
const MAX_SIZE_BYTES = parseInt(process.env.EVIDENCE_MAX_FILE_SIZE_MB ?? '1024', 10) * 1024 * 1024;

export interface ArchiveResult {
  id: string;
  sha256Hash: string;
  storagePath: string;
  sizeBytes: bigint;
}

class StorageService {
  async archiveBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    linkedTo: { type: 'message' | 'sale' | 'content_submission'; id: string },
    uploadedBy?: string,
  ): Promise<ArchiveResult> {
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error(`File exceeds max size of ${process.env.EVIDENCE_MAX_FILE_SIZE_MB}MB`);
    }

    const hash = sha256Hex(buffer);

    // Dedup: if we already have this exact file, link and return
    const existing = await prisma.evidenceFile.findUnique({ where: { sha256Hash: hash } });
    if (existing) {
      return {
        id: existing.id,
        sha256Hash: hash,
        storagePath: existing.storagePath,
        sizeBytes: existing.sizeBytes,
      };
    }

    const ext = extname(originalName) || `.${mime.extension(mimeType) || 'bin'}`;
    const fileName = `${generateToken(16)}${ext}`;
    const datePath = this.datePath();
    const dirPath = join(STORAGE_ROOT, datePath);
    await mkdir(dirPath, { recursive: true });

    const storagePath = join(datePath, fileName);
    const absolutePath = join(STORAGE_ROOT, storagePath);

    await this.writeFile(absolutePath, buffer);

    const record = await prisma.evidenceFile.create({
      data: {
        fileName,
        originalName,
        mimeType,
        sizeBytes: BigInt(buffer.length),
        sha256Hash: hash,
        storagePath,
        storageProvider: 'local',
        uploadedBy,
        ...(linkedTo.type === 'message' ? { messageId: linkedTo.id } : {}),
        ...(linkedTo.type === 'sale' ? { saleId: linkedTo.id } : {}),
        ...(linkedTo.type === 'content_submission' ? { contentSubmissionId: linkedTo.id } : {}),
      },
    });

    logger.info('Evidence archived', { id: record.id, hash, size: buffer.length, type: linkedTo.type });

    return {
      id: record.id,
      sha256Hash: hash,
      storagePath,
      sizeBytes: BigInt(buffer.length),
    };
  }

  async archiveFromUrl(
    url: string,
    linkedTo: { type: 'message' | 'sale' | 'content_submission'; id: string },
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

  getAbsolutePath(storagePath: string): string {
    return join(STORAGE_ROOT, storagePath);
  }

  private async writeFile(path: string, buffer: Buffer): Promise<void> {
    const ws = createWriteStream(path);
    await new Promise<void>((resolve, reject) => {
      ws.write(buffer, (err) => {
        if (err) reject(err);
        else ws.end(resolve);
      });
      ws.on('error', reject);
    });
  }

  private datePath(): string {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  }
}

export const storageService = new StorageService();
