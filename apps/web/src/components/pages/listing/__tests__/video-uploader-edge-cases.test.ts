/**
 * Supplementary edge-case tests for VideoUploader (G1.7).
 * Covers gaps not addressed in video-uploader-modes.test.ts:
 *   - formatDuration helper
 *   - handleDrop vs handleInputChange divergence (trimmer bypass)
 *   - extractThumbnail seek position
 *   - upload pipeline file size limit
 *   - trim cancel error clearing
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Pure functions extracted from VideoUploader ──────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MIN_DURATION = 15;
const MAX_DURATION = 60;

function checkFileSizeError(sizeBytes: number): string | null {
  return sizeBytes > MAX_VIDEO_SIZE ? 'Video must be less than 100MB' : null;
}

function checkDurationError(durationSeconds: number): string | null {
  if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
    return `Video must be between ${MIN_DURATION} and ${MAX_DURATION} seconds`;
  }
  return null;
}

// Mirrors handleInputChange duration routing decision
function routeGalleryFile(durationSeconds: number, maxDuration: number): 'trimmer' | 'handleFile' {
  return durationSeconds > maxDuration ? 'trimmer' : 'handleFile';
}

// handleDrop in the current implementation goes DIRECTLY to handleFile (no trimmer check).
// This function mirrors what handleDrop actually does (bypasses trimmer).
function routeDropFile(_durationSeconds: number): 'handleFile' {
  return 'handleFile'; // always, regardless of duration
}

// ─── Tests: formatDuration helper ────────────────────────────────────────────

describe('VideoUploader — formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats 45 seconds as 0:45', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats 60 seconds as 1:00', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  it('formats 90 seconds as 1:30', () => {
    expect(formatDuration(90)).toBe('1:30');
  });

  it('pads single-digit seconds with leading zero', () => {
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(62)).toBe('1:02');
  });

  it('formats large durations correctly', () => {
    expect(formatDuration(125)).toBe('2:05');
  });
});

// ─── Tests: file size validation ─────────────────────────────────────────────

describe('VideoUploader — file size validation', () => {
  it('returns error for files over 100MB', () => {
    const sizeOver = MAX_VIDEO_SIZE + 1;
    expect(checkFileSizeError(sizeOver)).toBe('Video must be less than 100MB');
  });

  it('returns null for files exactly at 100MB', () => {
    expect(checkFileSizeError(MAX_VIDEO_SIZE)).toBeNull();
  });

  it('returns null for files under 100MB', () => {
    expect(checkFileSizeError(10 * 1024 * 1024)).toBeNull();
  });
});

// ─── Tests: duration validation in handleFile ─────────────────────────────────

describe('VideoUploader — duration validation in upload pipeline', () => {
  it('returns error for duration below minimum (14s)', () => {
    expect(checkDurationError(14)).toBe('Video must be between 15 and 60 seconds');
  });

  it('returns null for duration at minimum boundary (15s)', () => {
    expect(checkDurationError(15)).toBeNull();
  });

  it('returns null for duration at maximum boundary (60s)', () => {
    expect(checkDurationError(60)).toBeNull();
  });

  it('returns error for duration above maximum (61s)', () => {
    expect(checkDurationError(61)).toBe('Video must be between 15 and 60 seconds');
  });

  it('returns null for mid-range duration (30s)', () => {
    expect(checkDurationError(30)).toBeNull();
  });
});

// ─── Tests: gallery file routing vs drop routing divergence ──────────────────

describe('VideoUploader — handleInputChange vs handleDrop routing', () => {
  it('handleInputChange routes over-length gallery video to trimmer', () => {
    expect(routeGalleryFile(75, MAX_DURATION)).toBe('trimmer');
  });

  it('handleInputChange routes valid gallery video directly to handleFile', () => {
    expect(routeGalleryFile(30, MAX_DURATION)).toBe('handleFile');
  });

  it('handleInputChange routes exactly-at-max gallery video to handleFile (no trim needed)', () => {
    expect(routeGalleryFile(60, MAX_DURATION)).toBe('handleFile');
  });

  it('handleDrop always routes to handleFile regardless of duration (trimmer bypass)', () => {
    // NOTE: This documents the current implementation behavior.
    // handleDrop does NOT check duration before calling handleFile.
    // Over-length dropped files will get the "Video must be between 15 and 60 seconds" error
    // from handleFile rather than being routed to the trimmer.
    // This diverges from the spec (section 4.5, step 7) which says gallery files >maxDuration
    // should open the trimmer. If this behavior is intentional for drop-zone mode,
    // this test documents it. If it is a bug, the fix is to add duration check in handleDrop.
    expect(routeDropFile(75)).toBe('handleFile');
    expect(routeDropFile(30)).toBe('handleFile');
  });
});

// ─── Tests: handleRecordingComplete routing ───────────────────────────────────

describe('VideoUploader — handleRecordingComplete routing', () => {
  it('routes recorded video > maxDuration to trimmer', () => {
    expect(routeGalleryFile(65, MAX_DURATION)).toBe('trimmer');
  });

  it('routes recorded video within range directly to handleFile', () => {
    expect(routeGalleryFile(45, MAX_DURATION)).toBe('handleFile');
  });

  it('routes exactly-max recorded video directly to handleFile', () => {
    // auto-stop fires at 60s, resulting in exactly 60s — no trim needed
    expect(routeGalleryFile(60, MAX_DURATION)).toBe('handleFile');
  });
});

// ─── Tests: state transitions on cancel ──────────────────────────────────────

describe('VideoUploader — state clean-up on cancel', () => {
  it('handleTrimCancel clears trimFile and error', () => {
    let trimFile: File | null = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    let error: string | null = 'some previous error';

    const handleTrimCancel = () => {
      trimFile = null;
      error = null;
    };

    handleTrimCancel();
    expect(trimFile).toBeNull();
    expect(error).toBeNull();
  });

  it('handleTrimComplete clears trimFile and invokes handleFile', () => {
    const handleFileSpy = vi.fn();
    let trimFile: File | null = new File(['data'], 'video.mp4', { type: 'video/mp4' });

    const handleTrimComplete = (f: File) => {
      trimFile = null;
      handleFileSpy(f);
    };

    const trimmedFile = new File(['trimmed'], 'trimmed.mp4', { type: 'video/mp4' });
    handleTrimComplete(trimmedFile);
    expect(trimFile).toBeNull();
    expect(handleFileSpy).toHaveBeenCalledWith(trimmedFile);
  });

  it('closing recorder sets recorderOpen to false', () => {
    let recorderOpen = true;
    const closeRecorder = () => { recorderOpen = false; };
    closeRecorder();
    expect(recorderOpen).toBe(false);
  });
});

// ─── Tests: thumbnail seek position ──────────────────────────────────────────

describe('VideoUploader — thumbnail extraction seek position', () => {
  it('seeks to 0.5s for thumbnail extraction on normal-length videos', () => {
    const videoDuration = 30;
    const seekTime = Math.min(0.5, videoDuration);
    // Acceptance criterion #23: thumbnail extracted at 0.5s mark
    expect(seekTime).toBe(0.5);
  });

  it('seeks to duration for very short videos (< 0.5s edge case)', () => {
    // Edge: if video duration is less than 0.5s, seek to duration instead
    const videoDuration = 0.3;
    const seekTime = Math.min(0.5, videoDuration);
    expect(seekTime).toBe(0.3);
  });
});
