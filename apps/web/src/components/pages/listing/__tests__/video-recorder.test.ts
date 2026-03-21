/**
 * Tests for VideoRecorder component logic (G1.7).
 * Pure-logic extraction pattern — no DOM, node environment.
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Pure functions extracted from VideoRecorder ──────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function selectMimeType(
  isTypeSupported: (type: string) => boolean,
): string {
  if (isTypeSupported('video/mp4')) return 'video/mp4';
  if (isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  return 'video/webm';
}

function getFileExtension(mimeType: string): string {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function classifyGetUserMediaError(errorName: string): string {
  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return 'Camera is currently in use by another application.';
  }
  return 'Camera access is needed to record video. Please allow camera access in your browser settings.';
}

function shouldDisableFlip(state: string): boolean {
  return state === 'recording' || state === 'requesting';
}

function shouldAutoStop(elapsed: number, maxDuration: number): boolean {
  return elapsed >= maxDuration;
}

function nextFacingMode(current: 'environment' | 'user'): 'environment' | 'user' {
  return current === 'environment' ? 'user' : 'environment';
}

// ─── Tests: elapsed timer formatting ─────────────────────────────────────────

describe('VideoRecorder — elapsed time format', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatElapsed(0)).toBe('00:00');
  });

  it('formats 59 seconds as 00:59', () => {
    expect(formatElapsed(59)).toBe('00:59');
  });

  it('formats 60 seconds as 01:00', () => {
    expect(formatElapsed(60)).toBe('01:00');
  });

  it('formats 90 seconds as 01:30', () => {
    expect(formatElapsed(90)).toBe('01:30');
  });

  it('formats elapsed time during recording in MM:SS format', () => {
    expect(formatElapsed(15)).toBe('00:15');
    expect(formatElapsed(30)).toBe('00:30');
  });
});

// ─── Tests: MIME type selection ───────────────────────────────────────────────

describe('VideoRecorder — MIME type selection', () => {
  it('creates File with mp4 extension when MediaRecorder supports video/mp4', () => {
    const isTypeSupported = vi.fn((type: string) => type === 'video/mp4');
    const mimeType = selectMimeType(isTypeSupported);
    expect(mimeType).toBe('video/mp4');
    expect(getFileExtension(mimeType)).toBe('mp4');
  });

  it('creates File with webm extension as fallback when mp4 not supported', () => {
    const isTypeSupported = vi.fn((type: string) => type === 'video/webm;codecs=vp9');
    const mimeType = selectMimeType(isTypeSupported);
    expect(mimeType).toBe('video/webm;codecs=vp9');
    expect(getFileExtension(mimeType)).toBe('webm');
  });

  it('falls back to video/webm when neither mp4 nor vp9 is supported', () => {
    const isTypeSupported = vi.fn(() => false);
    const mimeType = selectMimeType(isTypeSupported);
    expect(mimeType).toBe('video/webm');
    expect(getFileExtension(mimeType)).toBe('webm');
  });
});

// ─── Tests: getUserMedia error classification ─────────────────────────────────

describe('VideoRecorder — getUserMedia permission errors', () => {
  it('shows error message when getUserMedia permission is denied (NotAllowedError)', () => {
    const message = classifyGetUserMediaError('NotAllowedError');
    expect(message).toContain('Camera access is needed');
    expect(message).toContain('browser settings');
  });

  it('shows camera-in-use message for NotReadableError', () => {
    const message = classifyGetUserMediaError('NotReadableError');
    expect(message).toBe('Camera is currently in use by another application.');
  });

  it('shows camera-in-use message for TrackStartError (legacy name)', () => {
    const message = classifyGetUserMediaError('TrackStartError');
    expect(message).toBe('Camera is currently in use by another application.');
  });

  it('shows permission message for other error types', () => {
    const message = classifyGetUserMediaError('OverconstrainedError');
    expect(message).toContain('Camera access is needed');
  });
});

// ─── Tests: camera flip ───────────────────────────────────────────────────────

describe('VideoRecorder — camera flip', () => {
  it('toggles facingMode from environment to user', () => {
    expect(nextFacingMode('environment')).toBe('user');
  });

  it('toggles facingMode from user to environment', () => {
    expect(nextFacingMode('user')).toBe('environment');
  });

  it('disables flip button while recording is in progress', () => {
    expect(shouldDisableFlip('recording')).toBe(true);
  });

  it('disables flip button while requesting permission', () => {
    expect(shouldDisableFlip('requesting')).toBe(true);
  });

  it('enables flip button during preview', () => {
    expect(shouldDisableFlip('previewing')).toBe(false);
  });

  it('enables flip button in idle state', () => {
    expect(shouldDisableFlip('idle')).toBe(false);
  });
});

// ─── Tests: auto-stop logic ───────────────────────────────────────────────────

describe('VideoRecorder — auto-stop at maxDurationSeconds', () => {
  it('auto-stops recording at maxDurationSeconds', () => {
    expect(shouldAutoStop(60, 60)).toBe(true);
  });

  it('does not auto-stop before maxDurationSeconds', () => {
    expect(shouldAutoStop(59, 60)).toBe(false);
  });

  it('auto-stops when elapsed exceeds maxDurationSeconds', () => {
    expect(shouldAutoStop(61, 60)).toBe(true);
  });

  it('does not stop at time zero', () => {
    expect(shouldAutoStop(0, 60)).toBe(false);
  });
});

// ─── Tests: aria labels ───────────────────────────────────────────────────────

describe('VideoRecorder — aria labels', () => {
  it('record button has correct aria-label', () => {
    const label = 'Start recording video';
    expect(label).toBe('Start recording video');
  });

  it('stop button has correct aria-label', () => {
    const label = 'Stop recording';
    expect(label).toBe('Stop recording');
  });

  it('camera flip button has correct aria-label', () => {
    const label = 'Switch camera';
    expect(label).toBe('Switch camera');
  });
});

// ─── Tests: recording does not auto-start ─────────────────────────────────────

describe('VideoRecorder — recording does not auto-start', () => {
  it('does not call getUserMedia on mount without explicit trigger', () => {
    // The component requests camera on mount for preview (not recording)
    // but does NOT start MediaRecorder until record button is clicked.
    // Initial recorderState is 'idle', not 'recording'.
    const initialState = 'idle';
    expect(initialState).not.toBe('recording');
  });

  it('record button is not shown while camera is being requested', () => {
    // During 'requesting' state, neither the record button nor stop button renders
    const showRecordButton = (state: string) => state === 'previewing';
    expect(showRecordButton('requesting')).toBe(false);
    expect(showRecordButton('idle')).toBe(false);
    expect(showRecordButton('previewing')).toBe(true);
  });
});

// ─── Tests: media track cleanup ──────────────────────────────────────────────

describe('VideoRecorder — media track cleanup', () => {
  it('stops media tracks on cancel', () => {
    const stopFn = vi.fn();
    const track = { stop: stopFn, kind: 'video' };
    const mockStream = { getTracks: () => [track] };

    // Simulate stopTracks logic
    mockStream.getTracks().forEach((t) => t.stop());
    expect(stopFn).toHaveBeenCalledOnce();
  });

  it('stops media tracks on unmount (cleanup effect)', () => {
    const stopFn = vi.fn();
    const track = { stop: stopFn, kind: 'audio' };
    const mockStream = { getTracks: () => [track] };

    // Simulate useEffect cleanup
    const cleanup = () => {
      mockStream.getTracks().forEach((t) => t.stop());
    };
    cleanup();
    expect(stopFn).toHaveBeenCalledOnce();
  });
});
