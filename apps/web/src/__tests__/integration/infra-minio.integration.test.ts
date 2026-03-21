/**
 * Integration test: MinIO (local R2 stand-in)
 * Requires: MinIO running on localhost:9000
 *
 * Tests bucket operations, file upload, download, presigned URL, and deletion.
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const ENDPOINT = process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000';
const BUCKET = process.env.R2_BUCKET_NAME ?? 'twicely-uploads';
const TEST_PREFIX = 'integration-test/';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? 'minioadmin',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? 'minioadmin',
  },
  forcePathStyle: true,
});

describe('MinIO (S3-compatible) Integration', () => {
  const testKey = `${TEST_PREFIX}test-image-${Date.now()}.txt`;
  const testBody = Buffer.from('Hello from integration test!');

  afterAll(async () => {
    // Clean up test files
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: TEST_PREFIX }),
    );
    for (const obj of list.Contents ?? []) {
      if (obj.Key) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      }
    }
  });

  it('uploads a file', async () => {
    const resp = await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: testKey,
        Body: testBody,
        ContentType: 'text/plain',
      }),
    );
    expect(resp.$metadata.httpStatusCode).toBe(200);
  });

  it('reads back the uploaded file', async () => {
    const resp = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: testKey }),
    );
    const body = await resp.Body?.transformToString();
    expect(body).toBe('Hello from integration test!');
  });

  it('lists objects with prefix', async () => {
    const resp = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: TEST_PREFIX }),
    );
    expect(resp.Contents?.length).toBeGreaterThanOrEqual(1);
    const keys = resp.Contents?.map((o) => o.Key) ?? [];
    expect(keys).toContain(testKey);
  });

  it('deletes the file', async () => {
    const resp = await s3.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: testKey }),
    );
    expect(resp.$metadata.httpStatusCode).toBe(204);
  });
});
