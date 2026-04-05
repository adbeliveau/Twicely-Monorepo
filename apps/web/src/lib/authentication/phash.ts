/**
 * Perceptual hash (pHash) utility for photo fingerprinting.
 * Server-side only — never run on the client.
 * Uses DCT-based algorithm via sharp for image processing.
 */

import sharp from 'sharp';

const HASH_SIZE = 8;        // 8x8 DCT coefficients = 64 bits
const RESIZE_SIZE = 32;     // Resize image to 32x32 for DCT input
const HAMMING_THRESHOLD = 10;

/**
 * Apply Discrete Cosine Transform to a flat array of pixel values.
 * Returns the DCT coefficients as a flat array (row-major order).
 */
function applyDCT(pixels: number[], n: number): number[] {
  const result: number[] = new Array(n * n).fill(0) as number[];
  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      let sum = 0;
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          sum +=
            (pixels[x * n + y] ?? 0) *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * n));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      result[u * n + v] = (2 / n) * cu * cv * sum;
    }
  }
  return result;
}

/**
 * Compute perceptual hash (pHash) for an image URL.
 * Returns a 16-character hex string (64-bit hash).
 */
/** Allowed hostnames for image fetching (SSRF prevention — SEC-006). */
const ALLOWED_PHASH_HOSTNAMES = new Set([
  'twicely.co',
  'www.twicely.co',
  'cdn.twicely.co',
  'images.twicely.co',
  'storage.googleapis.com',
  'res.cloudinary.com',
  'utfs.io',
]);

export async function computePerceptualHash(imageUrl: string): Promise<string> {
  const parsed = new URL(imageUrl);
  if (!ALLOWED_PHASH_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(`Image URL hostname not allowed: ${parsed.hostname}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS image URLs are allowed');
  }
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  const { data } = await sharp(buffer)
    .resize(RESIZE_SIZE, RESIZE_SIZE)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data) as number[];
  const dct = applyDCT(pixels, RESIZE_SIZE);

  // Extract top-left HASH_SIZE x HASH_SIZE coefficients (skip DC component at 0,0)
  const topLeft: number[] = [];
  for (let u = 0; u < HASH_SIZE; u++) {
    for (let v = 0; v < HASH_SIZE; v++) {
      if (u === 0 && v === 0) continue; // skip DC component
      topLeft.push(dct[u * RESIZE_SIZE + v] ?? 0);
    }
  }

  // Threshold at median
  const sorted = [...topLeft].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  // Produce 64-bit binary hash: 1 if above median, 0 otherwise
  // We have 63 values (64 - DC), pad to 64 bits
  const bits = topLeft.map((v) => (v > median ? 1 : 0));
  bits.push(0); // 64th bit = 0 (padding)

  // Convert 64 bits to 16 hex chars
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble =
      ((bits[i] ?? 0) << 3) |
      ((bits[i + 1] ?? 0) << 2) |
      ((bits[i + 2] ?? 0) << 1) |
      (bits[i + 3] ?? 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Compute composite hash for multiple images.
 * Concatenates individual hashes with '|' separator.
 */
export async function computeCompositeHash(imageUrls: string[]): Promise<string> {
  const hashes = await Promise.all(imageUrls.map((url) => computePerceptualHash(url)));
  return hashes.join('|');
}

/**
 * Compare two perceptual hashes.
 * Returns Hamming distance (0 = identical, 64 = completely different).
 * Operates on the first 16-char hex segment of composite hashes.
 */
export function compareHashes(hash1: string, hash2: string): number {
  // Take only the first hash segment if composite
  const h1 = hash1.split('|')[0] ?? '';
  const h2 = hash2.split('|')[0] ?? '';

  if (h1.length !== h2.length || h1.length !== 16) {
    throw new Error('Invalid hash format: expected 16-character hex string');
  }

  let distance = 0;
  for (let i = 0; i < h1.length; i++) {
    const xor = parseInt(h1[i] ?? '0', 16) ^ parseInt(h2[i] ?? '0', 16);
    // Count bits in xor nibble
    distance += (xor >>> 3) & 1;
    distance += (xor >>> 2) & 1;
    distance += (xor >>> 1) & 1;
    distance += xor & 1;
  }
  return distance;
}

/**
 * Check if a new set of photos matches an existing fingerprint.
 * Used to detect certificate fraud.
 * Returns matches=true if Hamming distance <= threshold (default 10).
 */
export async function verifyPhotoFingerprint(
  photoUrls: string[],
  storedHash: string,
  threshold: number = HAMMING_THRESHOLD
): Promise<{ matches: boolean; distance: number }> {
  const newHash = await computeCompositeHash(photoUrls);
  const distance = compareHashes(newHash, storedHash);
  return { matches: distance <= threshold, distance };
}
