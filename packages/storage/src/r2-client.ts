/**
 * R2 Client — Cloudflare R2 Storage Integration
 *
 * Uses @aws-sdk/client-s3 with R2-compatible endpoint.
 * Falls back to mock URLs in dev mode when R2_ACCOUNT_ID is missing.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Environment configuration
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'twicely-uploads';
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://cdn.twicely.com';
/** Optional: override endpoint for local S3-compatible storage (MinIO) */
const S3_ENDPOINT = process.env.S3_ENDPOINT;

const isConfigured = !!(
  (R2_ACCOUNT_ID || S3_ENDPOINT) && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
);

// Lazy-initialize S3Client only when needed
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!isConfigured) return null;
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: S3_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!S3_ENDPOINT,
    });
  }
  return _s3Client;
}

/**
 * Upload a file to R2.
 * Returns the public URL of the uploaded file.
 *
 * In dev mode (missing credentials), returns a mock URL.
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client();

  if (!client) {
    console.warn('[R2] Credentials not configured, returning mock URL');
    return `${R2_PUBLIC_URL}/mock/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete a file from R2.
 *
 * In dev mode, silently succeeds.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getS3Client();

  if (!client) {
    console.warn('[R2] Credentials not configured, skipping delete');
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
}

/**
 * Generate a pre-signed URL for direct upload to R2.
 * Used for client-side uploads to bypass server bandwidth.
 *
 * @param key - The S3 key for the upload
 * @param contentType - The MIME type of the file
 * @param expiresIn - URL expiry in seconds (default 3600 = 1 hour)
 */
export async function generateSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();

  if (!client) {
    console.warn('[R2] Credentials not configured, returning mock presigned URL');
    return `${R2_PUBLIC_URL}/mock-presigned/${key}?expires=${expiresIn}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Extract the key from a full R2 URL.
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!url.startsWith(R2_PUBLIC_URL)) return null;
  return url.slice(R2_PUBLIC_URL.length + 1);
}

/**
 * Check if R2 is configured and available.
 */
export function isR2Configured(): boolean {
  return isConfigured;
}
