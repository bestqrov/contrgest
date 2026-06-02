import type { Job } from 'bullmq';
import axios from 'axios';
import mime from 'mime-types';
import { prisma } from '@field-ops/db';
import { uploadBuffer, evidenceKey, EVIDENCE_BUCKET, sha256Hex, createLogger } from '@field-ops/shared';
import type { MessageType } from '@field-ops/db';

const logger = createLogger('whatsapp-logger:media');

export async function processMediaJob(job: Job): Promise<void> {
  const { messageId, mediaUrl, msgType } = job.data as {
    messageId: string;
    mediaUrl: string;
    msgType: MessageType;
  };

  const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'fieldops-main';
  const apiKey = process.env.EVOLUTION_API_KEY!;
  const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://evolution-api:8080';

  let buffer: Buffer;
  let contentType = 'application/octet-stream';

  try {
    // Try Evolution API download endpoint first
    const downloadUrl = `${baseUrl}/message/downloadMediaMessage/${instance}`;
    const response = await axios.post<ArrayBuffer>(
      downloadUrl,
      { message: { mediaUrl } },
      {
        headers: { apikey: apiKey },
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: 500 * 1024 * 1024,
      },
    );
    buffer = Buffer.from(response.data);
    contentType = (response.headers['content-type'] as string | undefined) ?? contentType;
  } catch {
    // Fallback: try direct URL download
    try {
      const response = await axios.get<ArrayBuffer>(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: 500 * 1024 * 1024,
      });
      buffer = Buffer.from(response.data);
      contentType = (response.headers['content-type'] as string | undefined) ?? contentType;
    } catch (err) {
      logger.error('Media download failed (both methods)', {
        messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }

  const hash = sha256Hex(buffer);
  const ext = mime.extension(contentType) || typeToExt(msgType);
  const key = evidenceKey('whatsapp-media', new Date(), hash, ext as string);

  await uploadBuffer(EVIDENCE_BUCKET, key, buffer, contentType, {
    messageId,
    msgType: msgType as string,
  });

  await prisma.message.update({
    where: { id: messageId },
    data: { mediaHash: hash, mediaLocalPath: key },
  });

  logger.info('Media archived', { messageId, hash, key, size: buffer.length });
}

function typeToExt(msgType: MessageType): string {
  const map: Record<string, string> = {
    IMAGE: 'jpg',
    VIDEO: 'mp4',
    AUDIO: 'ogg',
    DOCUMENT: 'bin',
    STICKER: 'webp',
  };
  return map[msgType as string] ?? 'bin';
}
