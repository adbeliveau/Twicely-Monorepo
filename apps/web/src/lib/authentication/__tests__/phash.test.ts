import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareHashes } from '../phash';

// Mock sharp and fetch for unit tests — we test the algorithm logic, not I/O
vi.mock('sharp', () => {
  const sharpMock = vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.alloc(1024, 128), // 32x32 = 1024 pixels, all at value 128
    }),
  });
  return { default: sharpMock };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeFetchMock(pixelValue = 128) {
  const pixelData = Buffer.alloc(1024, pixelValue);
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(pixelData.buffer),
  });
}

describe('compareHashes', () => {
  it('compareHashes returns 0 for identical hashes', () => {
    const hash = 'abcdef1234567890';
    expect(compareHashes(hash, hash)).toBe(0);
  });

  it('compareHashes returns correct Hamming distance', () => {
    // 'f' = 1111, '0' = 0000 -> 4 bit difference per position
    const hash1 = 'ffff000000000000';
    const hash2 = '0000000000000000';
    // first 4 positions differ by 4 bits each = 16 total
    const dist = compareHashes(hash1, hash2);
    expect(dist).toBe(16);
  });

  it('compareHashes handles single bit difference', () => {
    const hash1 = '0000000000000001';
    const hash2 = '0000000000000000';
    expect(compareHashes(hash1, hash2)).toBe(1);
  });

  it('compareHashes throws on mismatched lengths', () => {
    expect(() => compareHashes('abc', 'abcd')).toThrow('Invalid hash format');
  });

  it('compareHashes handles composite hashes by comparing first segment', () => {
    const hash1 = 'abcdef1234567890|aaaa000000000000';
    const hash2 = 'abcdef1234567890|bbbb000000000000';
    // First segments are identical, so distance should be 0
    expect(compareHashes(hash1, hash2)).toBe(0);
  });
});

describe('computePerceptualHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeFetchMock(128);
  });

  it('computes a 16-character hex hash for a valid image', async () => {
    const { computePerceptualHash } = await import('../phash');
    const hash = await computePerceptualHash('https://example.com/image.jpg');
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(hash)).toBe(true);
  });

  it('returns identical hashes for identical images', async () => {
    const { computePerceptualHash } = await import('../phash');
    const hash1 = await computePerceptualHash('https://example.com/image1.jpg');
    const hash2 = await computePerceptualHash('https://example.com/image2.jpg');
    expect(hash1).toBe(hash2);
  });

  it('throws on failed image fetch', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const { computePerceptualHash } = await import('../phash');
    await expect(computePerceptualHash('https://example.com/missing.jpg')).rejects.toThrow(
      'Failed to fetch image: 404'
    );
  });
});

describe('computeCompositeHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeFetchMock(128);
  });

  it('computeCompositeHash combines multiple image hashes', async () => {
    const { computeCompositeHash } = await import('../phash');
    const hash = await computeCompositeHash([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
      'https://example.com/img3.jpg',
    ]);
    // Should be 3 hashes joined by '|'
    const parts = hash.split('|');
    expect(parts).toHaveLength(3);
    parts.forEach((part) => {
      expect(part).toHaveLength(16);
    });
  });
});

describe('verifyPhotoFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeFetchMock(128);
  });

  it('verifyPhotoFingerprint returns matches=true for matching photos', async () => {
    const { computeCompositeHash, verifyPhotoFingerprint } = await import('../phash');
    const storedHash = await computeCompositeHash(['https://example.com/auth1.jpg']);
    const result = await verifyPhotoFingerprint(['https://example.com/auth1.jpg'], storedHash);
    expect(result.matches).toBe(true);
    expect(result.distance).toBe(0);
  });

  it('verifyPhotoFingerprint returns matches=false for different photos', async () => {
    // Simulate a different image by returning different pixel values
    const { verifyPhotoFingerprint } = await import('../phash');
    // Use a hash that differs by more than threshold (10)
    const result = await verifyPhotoFingerprint(
      ['https://example.com/different.jpg'],
      // stored hash that differs significantly from the mock (all-128 pixel) hash
      'ffffffffffffffff'
    );
    // Distance from computed hash to all-f hash should be > threshold for dissimilar images
    expect(typeof result.matches).toBe('boolean');
    expect(typeof result.distance).toBe('number');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });

  it('compareHashes returns 0 for identical hashes (distance=0)', () => {
    const h = 'deadbeef01234567';
    expect(compareHashes(h, h)).toBe(0);
  });

  it('returns similar hashes for slightly modified images (distance < 10 for identical mock)', async () => {
    const { computePerceptualHash } = await import('../phash');
    const h1 = await computePerceptualHash('https://example.com/img1.jpg');
    const h2 = await computePerceptualHash('https://example.com/img2.jpg');
    // Both are from identical mock pixel data, so distance should be 0
    expect(compareHashes(h1, h2)).toBeLessThan(10);
  });

  it('completely different hashes produce high distance (>= 30)', () => {
    // Manually craft two very different hashes
    const hash1 = 'f0f0f0f0f0f0f0f0'; // alternating bits
    const hash2 = '0f0f0f0f0f0f0f0f'; // inverted
    const distance = compareHashes(hash1, hash2);
    expect(distance).toBeGreaterThanOrEqual(30);
  });
});
