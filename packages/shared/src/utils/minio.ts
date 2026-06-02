import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://minio:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
  return _client;
}

export const EVIDENCE_BUCKET =
  process.env.MINIO_EVIDENCE_BUCKET ?? 'fieldops-evidence';
export const APK_BUCKET =
  process.env.MINIO_APK_BUCKET ?? 'fieldops-apk';

export interface UploadResult {
  bucket: string;
  key: string;
  sha256Hash: string;
  sizeBytes: number;
  url: string;
}

export async function uploadBuffer(
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<UploadResult> {
  const sha256Hash = createHash('sha256').update(data).digest('hex');

  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
    ContentLength: data.length,
    Metadata: {
      sha256: sha256Hash,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  };

  await getClient().send(new PutObjectCommand(input));

  const publicUrl =
    process.env.MINIO_PUBLIC_URL ??
    process.env.MINIO_ENDPOINT ??
    'http://minio:9000';
  const url = `${publicUrl}/${bucket}/${key}`;

  return { bucket, key, sha256Hash, sizeBytes: data.length, url };
}

export async function objectExists(
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Build a deterministic MinIO object key for evidence files.
 * Pattern: {category}/{year}/{month}/{day}/{sha256}.{ext}
 */
export function evidenceKey(
  category: string,
  date: Date,
  sha256: string,
  ext: string,
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${category}/${y}/${m}/${d}/${sha256}.${ext}`;
}
