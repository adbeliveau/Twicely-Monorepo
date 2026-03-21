import { describe, it, expect } from 'vitest';
import {
  detectVideoType,
  validateVideoBytes,
  getVideoExtension,
  getVideoContentType,
  MAX_VIDEO_SIZE,
} from '../validate-video';

// Helper: build a minimal MP4 header (ftyp at offset 4, generic mp42 brand at offset 8)
function makeMp4Bytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  // Size (4 bytes) — irrelevant for detection
  bytes[0] = 0x00; bytes[1] = 0x00; bytes[2] = 0x00; bytes[3] = 0x18;
  // 'ftyp' at offset 4
  bytes[4] = 0x66; bytes[5] = 0x74; bytes[6] = 0x79; bytes[7] = 0x70;
  // Brand 'mp42' at offset 8
  bytes[8] = 0x6d; bytes[9] = 0x70; bytes[10] = 0x34; bytes[11] = 0x32;
  return bytes;
}

// Helper: build a minimal MOV header (ftyp at offset 4, 'qt  ' brand at offset 8)
function makeMovBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes[0] = 0x00; bytes[1] = 0x00; bytes[2] = 0x00; bytes[3] = 0x18;
  // 'ftyp' at offset 4
  bytes[4] = 0x66; bytes[5] = 0x74; bytes[6] = 0x79; bytes[7] = 0x70;
  // 'qt  ' at offset 8
  bytes[8] = 0x71; bytes[9] = 0x74; bytes[10] = 0x20; bytes[11] = 0x20;
  return bytes;
}

// Helper: build a minimal WebM header (EBML at offset 0)
function makeWebmBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes[0] = 0x1a; bytes[1] = 0x45; bytes[2] = 0xdf; bytes[3] = 0xa3;
  return bytes;
}

// JPEG magic bytes
function makeJpegBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
  return bytes;
}

// PNG magic bytes
function makePngBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4e; bytes[3] = 0x47;
  return bytes;
}

describe('detectVideoType', () => {
  it('detects MP4 from ftyp magic bytes', () => {
    expect(detectVideoType(makeMp4Bytes())).toBe('mp4');
  });

  it('detects MOV from ftyp + qt brand magic bytes', () => {
    expect(detectVideoType(makeMovBytes())).toBe('mov');
  });

  it('detects WebM from EBML header magic bytes', () => {
    expect(detectVideoType(makeWebmBytes())).toBe('webm');
  });

  it('returns null for JPEG bytes', () => {
    expect(detectVideoType(makeJpegBytes())).toBeNull();
  });

  it('returns null for PNG bytes', () => {
    expect(detectVideoType(makePngBytes())).toBeNull();
  });

  it('returns null for empty buffer', () => {
    expect(detectVideoType(new Uint8Array(0))).toBeNull();
  });

  it('returns null for buffer smaller than 12 bytes', () => {
    expect(detectVideoType(new Uint8Array(8))).toBeNull();
  });

  it('returns null for buffer of exactly 11 bytes', () => {
    expect(detectVideoType(new Uint8Array(11))).toBeNull();
  });

  it('detects webm at exactly 12 bytes', () => {
    // EBML header fits in 4 bytes, rest are zero-padded to meet minimum
    const bytes = new Uint8Array(12);
    bytes[0] = 0x1a; bytes[1] = 0x45; bytes[2] = 0xdf; bytes[3] = 0xa3;
    expect(detectVideoType(bytes)).toBe('webm');
  });

  it('returns null for zeroed buffer', () => {
    expect(detectVideoType(new Uint8Array(16))).toBeNull();
  });
});

describe('validateVideoBytes', () => {
  it('accepts valid MP4 bytes within size limit', () => {
    const result = validateVideoBytes(makeMp4Bytes(), 1024);
    expect(result.valid).toBe(true);
  });

  it('accepts valid WebM bytes within size limit', () => {
    const result = validateVideoBytes(makeWebmBytes(), 1024);
    expect(result.valid).toBe(true);
  });

  it('rejects file exceeding max size', () => {
    const result = validateVideoBytes(makeMp4Bytes(), MAX_VIDEO_SIZE + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('less than');
  });

  it('rejects 0-byte file', () => {
    const result = validateVideoBytes(new Uint8Array(0), 0);
    expect(result.valid).toBe(false);
  });

  it('rejects file at exactly max size + 1 byte', () => {
    const result = validateVideoBytes(makeMp4Bytes(), MAX_VIDEO_SIZE + 1);
    expect(result.valid).toBe(false);
  });

  it('accepts file at exactly max size boundary', () => {
    const result = validateVideoBytes(makeMp4Bytes(), MAX_VIDEO_SIZE);
    expect(result.valid).toBe(true);
  });

  it('rejects non-video magic bytes', () => {
    const result = validateVideoBytes(makeJpegBytes(), 1024);
    expect(result.valid).toBe(false);
  });

  it('returns descriptive error for oversized file', () => {
    const result = validateVideoBytes(makeMp4Bytes(), MAX_VIDEO_SIZE + 1);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('100MB');
  });

  it('returns descriptive error for invalid format', () => {
    const result = validateVideoBytes(makeJpegBytes(), 1024);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('MP4');
  });

  it('accepts valid MOV bytes within size limit', () => {
    const result = validateVideoBytes(makeMovBytes(), 1024);
    expect(result.valid).toBe(true);
  });

  it('returns error message mentioning size limit in MB', () => {
    const result = validateVideoBytes(makeMp4Bytes(), MAX_VIDEO_SIZE + 1);
    // Size is 100MB
    expect(result.error).toMatch(/100MB/);
  });

  it('returns empty-file error before size check', () => {
    const result = validateVideoBytes(new Uint8Array(16), 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });
});

describe('getVideoExtension', () => {
  it('returns mp4 for mp4 type', () => {
    expect(getVideoExtension('mp4')).toBe('mp4');
  });

  it('returns mov for mov type', () => {
    expect(getVideoExtension('mov')).toBe('mov');
  });

  it('returns webm for webm type', () => {
    expect(getVideoExtension('webm')).toBe('webm');
  });
});

describe('getVideoContentType', () => {
  it('returns video/mp4 for mp4', () => {
    expect(getVideoContentType('mp4')).toBe('video/mp4');
  });

  it('returns video/quicktime for mov', () => {
    expect(getVideoContentType('mov')).toBe('video/quicktime');
  });

  it('returns video/webm for webm', () => {
    expect(getVideoContentType('webm')).toBe('video/webm');
  });
});
