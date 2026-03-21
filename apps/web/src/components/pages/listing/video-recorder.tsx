'use client';

// NOTE: Actors/Security Canonical specifies Permissions-Policy camera=() which would block
// getUserMedia. When security headers are implemented (G6), update to camera=(self).

import { useRef, useState, useEffect, useCallback } from 'react';
import { X, Camera, CameraOff, FlipHorizontal, Circle, Square } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { cn } from '@twicely/utils';

interface VideoRecorderProps {
  maxDurationSeconds: number;
  minDurationSeconds: number;
  onRecordingComplete: (file: File) => void;
  onCancel: () => void;
}

type FacingMode = 'environment' | 'user';
type RecorderState = 'idle' | 'requesting' | 'previewing' | 'recording' | 'error';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function selectMimeType(): string {
  if (
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/mp4')
  ) {
    return 'video/mp4';
  }
  if (
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
  ) {
    return 'video/webm;codecs=vp9';
  }
  return 'video/webm';
}

export function VideoRecorder({
  maxDurationSeconds,
  onRecordingComplete,
  onCancel,
}: VideoRecorderProps) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPreview = useCallback(async (facing: FacingMode) => {
    stopTracks();
    setErrorMessage(null);
    setRecorderState('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
    } catch (err) {
      const domErr = err as { name?: string };
      if (domErr.name === 'NotReadableError' || domErr.name === 'TrackStartError') {
        setErrorMessage('Camera is currently in use by another application.');
      } else {
        setErrorMessage(
          'Camera access is needed to record video. Please allow camera access in your browser settings.',
        );
      }
      setRecorderState('error');
      return;
    }

    streamRef.current = stream;
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
    }
    setRecorderState('previewing');
  }, [stopTracks]);

  useEffect(() => {
    void startPreview(facingMode);
    return () => {
      stopTracks();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, [stopTracks]);

  const handleFlip = useCallback(() => {
    if (recorderState === 'recording') return;
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    void startPreview(next);
  }, [facingMode, recorderState, startPreview]);

  const startRecording = useCallback(() => {
    if (!streamRef.current || recorderState !== 'previewing') return;

    const mimeType = selectMimeType();
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });
    chunksRef.current = [];

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `recording.${ext}`, { type: mimeType });
      onRecordingComplete(file);
    };

    recorder.onerror = () => {
      setErrorMessage('Recording failed. Please try again.');
      setRecorderState('previewing');
      stopTracks();
    };

    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setRecorderState('recording');

    let secs = 0;
    timerRef.current = setInterval(() => {
      secs += 1;
      setElapsed(secs);
      if (secs >= maxDurationSeconds) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        recorder.stop();
        setRecorderState('previewing');
      }
    }, 1000);
  }, [recorderState, maxDurationSeconds, onRecordingComplete, stopTracks]);

  const stopRecording = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecorderState('previewing');
  }, []);

  const handleCancel = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null; // prevent onRecordingComplete firing
      recorderRef.current.stop();
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopTracks();
    onCancel();
  }, [stopTracks, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Cancel button */}
      <div className="absolute left-4 top-4 z-10">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={handleCancel}
          aria-label="Cancel recording"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Elapsed time */}
      {recorderState === 'recording' && (
        <div className="absolute left-0 right-0 top-4 z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5">
            <span className="h-2.5 w-2.5 animate-pulse motion-reduce:animate-none rounded-full bg-red-500" />
            <span className="font-mono text-sm text-white">{formatElapsed(elapsed)}</span>
          </div>
        </div>
      )}

      {/* Camera flip button */}
      <div className="absolute right-4 top-4 z-10">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-11 w-11 rounded-full bg-black/50 text-white hover:bg-black/70',
            recorderState === 'recording' && 'opacity-40',
          )}
          onClick={handleFlip}
          disabled={recorderState === 'recording' || recorderState === 'requesting'}
          aria-label="Switch camera"
        >
          <FlipHorizontal className="h-6 w-6" />
        </Button>
      </div>

      {/* Video preview */}
      {recorderState !== 'error' && (
        <video
          ref={previewRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          aria-label="Camera preview"
        />
      )}

      {/* Error state */}
      {recorderState === 'error' && (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <CameraOff className="h-12 w-12 text-white/60" />
          <p className="text-sm text-white/80">{errorMessage}</p>
          <Button
            type="button"
            variant="outline"
            className="text-white"
            onClick={handleCancel}
          >
            Go back
          </Button>
        </div>
      )}

      {/* Recording controls */}
      {(recorderState === 'previewing' || recorderState === 'recording') && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center">
          {recorderState === 'previewing' ? (
            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={startRecording}
              aria-label="Start recording video"
            >
              <Camera className="h-8 w-8 text-white" />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={stopRecording}
              aria-label="Stop recording"
            >
              <Square className="h-8 w-8 fill-red-500 text-red-500" />
            </button>
          )}
        </div>
      )}

      {/* Requesting permission indicator */}
      {recorderState === 'requesting' && (
        <div className="flex h-full items-center justify-center">
          <Circle className="h-8 w-8 animate-spin text-white/60" />
        </div>
      )}
    </div>
  );
}
