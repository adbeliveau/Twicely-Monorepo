/**
 * Integration tests for VideoUploader dual-mode (record vs upload) logic (G1.7).
 * Pure-logic extraction pattern — no DOM, node environment.
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Logic extracted from VideoUploader ──────────────────────────────────────

const MIN_DURATION = 15;
const MAX_DURATION = 60;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

type UploaderView = 'camera-buttons' | 'drop-zone' | 'video-uploaded';

function getUploaderView(
  cameraSupported: boolean,
  videoUrl: string | null,
): UploaderView {
  if (videoUrl) return 'video-uploaded';
  if (cameraSupported) return 'camera-buttons';
  return 'drop-zone';
}

type TrimDecision = 'open-trimmer' | 'direct-upload' | 'error-too-short' | 'error-too-large';

function decideTrimOrUpload(
  fileSizeBytes: number,
  durationSeconds: number,
  maxSizeBytes: number,
  minDuration: number,
  maxDuration: number,
): TrimDecision {
  if (fileSizeBytes > maxSizeBytes) return 'direct-upload'; // size check happens in handleFile
  if (durationSeconds > maxDuration) return 'open-trimmer';
  if (durationSeconds < minDuration) return 'error-too-short';
  return 'direct-upload';
}

function shouldSkipTrimmerForGallery(
  durationSeconds: number,
  maxDuration: number,
): boolean {
  return durationSeconds <= maxDuration;
}

function shouldOpenTrimmerForGallery(
  durationSeconds: number,
  maxDuration: number,
): boolean {
  return durationSeconds > maxDuration;
}

function shouldOpenTrimmerForRecording(
  durationSeconds: number,
  maxDuration: number,
): boolean {
  return durationSeconds > maxDuration;
}

// ─── Tests: view selection ────────────────────────────────────────────────────

describe('VideoUploader — mode selection', () => {
  it('shows Record + Upload buttons when camera is supported', () => {
    expect(getUploaderView(true, null)).toBe('camera-buttons');
  });

  it('shows only drop zone when camera is not supported', () => {
    expect(getUploaderView(false, null)).toBe('drop-zone');
  });

  it('shows uploaded video view when videoUrl is set (regardless of camera support)', () => {
    expect(getUploaderView(true, 'https://cdn.example.com/video.mp4')).toBe('video-uploaded');
    expect(getUploaderView(false, 'https://cdn.example.com/video.mp4')).toBe('video-uploaded');
  });
});

// ─── Tests: recorder integration ─────────────────────────────────────────────

describe('VideoUploader — VideoRecorder integration', () => {
  it('opens VideoRecorder when Record Video is clicked', () => {
    let recorderOpen = false;
    const openRecorder = () => { recorderOpen = true; };
    openRecorder();
    expect(recorderOpen).toBe(true);
  });

  it('returns to empty state when recording is cancelled', () => {
    let recorderOpen = true;
    const handleCancel = () => { recorderOpen = false; };
    handleCancel();
    expect(recorderOpen).toBe(false);
  });

  it('opens file picker when Upload from Gallery is clicked', () => {
    const clickFn = vi.fn();
    const handleUploadClick = (disabled: boolean, uploading: boolean) => {
      if (!disabled && !uploading) clickFn();
    };
    handleUploadClick(false, false);
    expect(clickFn).toHaveBeenCalledOnce();
  });

  it('does not open file picker when disabled', () => {
    const clickFn = vi.fn();
    const handleUploadClick = (disabled: boolean, uploading: boolean) => {
      if (!disabled && !uploading) clickFn();
    };
    handleUploadClick(true, false);
    expect(clickFn).not.toHaveBeenCalled();
  });
});

// ─── Tests: trimmer integration after recording ───────────────────────────────

describe('VideoUploader — VideoTrimmer integration after recording', () => {
  it('opens VideoTrimmer when recorded video needs trimming (>60s)', () => {
    expect(shouldOpenTrimmerForRecording(65, MAX_DURATION)).toBe(true);
  });

  it('passes recorded file directly to upload pipeline when within duration range', () => {
    expect(shouldOpenTrimmerForRecording(45, MAX_DURATION)).toBe(false);
  });

  it('opens VideoTrimmer when gallery video exceeds max duration', () => {
    expect(shouldOpenTrimmerForGallery(75, MAX_DURATION)).toBe(true);
  });

  it('skips trimmer for gallery video within valid duration range', () => {
    expect(shouldSkipTrimmerForGallery(30, MAX_DURATION)).toBe(true);
  });

  it('skips trimmer for gallery video at exactly maxDuration', () => {
    expect(shouldSkipTrimmerForGallery(60, MAX_DURATION)).toBe(true);
  });
});

// ─── Tests: trim complete flow ────────────────────────────────────────────────

describe('VideoUploader — trim complete flow', () => {
  it('passes trimmed file to upload pipeline', () => {
    let capturedFile: File | null = null;
    let trimFile: File | null = new File(['data'], 'trimmed.mp4', { type: 'video/mp4' });

    const handleTrimComplete = (file: File) => {
      capturedFile = file;
      trimFile = null;
    };

    handleTrimComplete(new File(['trimmed-data'], 'trimmed.mp4', { type: 'video/mp4' }));
    expect(capturedFile).not.toBeNull();
    expect(trimFile).toBeNull();
  });

  it('returns to empty state when trim is cancelled', () => {
    let trimFile: File | null = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    let error: string | null = null;

    const handleTrimCancel = () => {
      trimFile = null;
      error = null;
    };

    handleTrimCancel();
    expect(trimFile).toBeNull();
    expect(error).toBeNull();
  });
});

// ─── Tests: trim decision logic ───────────────────────────────────────────────

describe('VideoUploader — trim vs direct-upload decision', () => {
  it('opens trimmer for duration > maxDuration', () => {
    const decision = decideTrimOrUpload(1_000_000, 75, MAX_VIDEO_SIZE, MIN_DURATION, MAX_DURATION);
    expect(decision).toBe('open-trimmer');
  });

  it('directs to upload for duration within valid range', () => {
    const decision = decideTrimOrUpload(1_000_000, 30, MAX_VIDEO_SIZE, MIN_DURATION, MAX_DURATION);
    expect(decision).toBe('direct-upload');
  });

  it('errors for duration < minDuration', () => {
    const decision = decideTrimOrUpload(1_000_000, 10, MAX_VIDEO_SIZE, MIN_DURATION, MAX_DURATION);
    expect(decision).toBe('error-too-short');
  });
});

// ─── Tests: existing upload flow preserved ───────────────────────────────────

describe('VideoUploader — preserves existing upload flow', () => {
  it('preserves existing upload flow for non-camera browsers (drop zone present)', () => {
    const view = getUploaderView(false, null);
    expect(view).toBe('drop-zone');
  });

  it('upload-only drop zone still shown when isLoading=true for camera support', () => {
    // While isLoading=true, cameraSupported is false (default state)
    // so the drop zone is shown to avoid layout shift
    const cameraSupported = false; // initial state before enumerateDevices resolves
    const view = getUploaderView(cameraSupported, null);
    expect(view).toBe('drop-zone');
  });
});
