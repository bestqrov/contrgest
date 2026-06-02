import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'crypto';
import { createReadStream } from 'fs';

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ─── HMAC ─────────────────────────────────────────────────────────────────────

export function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHmac(
  data: string,
  secret: string,
  signature: string,
): boolean {
  const expected = hmacSha256(data, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ─── AES-256-GCM ─────────────────────────────────────────────────────────────

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;

/**
 * Derive a 256-bit AES key from a device token using SHA-256.
 * The Android agent uses HKDF — this is the server-side equivalent.
 */
export function deriveAesKey(deviceToken: string): Buffer {
  return createHash('sha256').update(deviceToken).digest();
}

/**
 * Encrypt with AES-256-GCM.
 * Output: base64(iv[12] + authTag[16] + ciphertext)
 */
export function aesEncrypt(plaintext: Buffer | string, key: Buffer): string {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error('AES key must be 32 bytes');
  }
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, 'utf8');
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt AES-256-GCM ciphertext produced by aesEncrypt.
 */
export function aesDecrypt(ciphertextBase64: string, key: Buffer): Buffer {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error('AES key must be 32 bytes');
  }
  const raw = Buffer.from(ciphertextBase64, 'base64');
  const iv = raw.subarray(0, GCM_IV_LENGTH);
  const tag = raw.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const data = raw.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
