'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { X, Play, Scissors, Loader2 } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { cn } from '@twicely/utils';

interface VideoTrimmerProps {
  videoFile: File;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  onTrimComplete: (trimmedFile: File) => void;
  onCancel: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function selectMimeType(): string {
  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  }
  return 'video/webm';
}

export function VideoTrimmer({ videoFile, minDurationSeconds, maxDurationSeconds, onTrimComplete, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const trackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [noCaptureStream, setNoCaptureStream] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    objectUrlRef.current = url;
    return () => {
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
      if (trackRef.current !== null) { clearInterval(trackRef.current); trackRef.current = null; }
    };
  }, [videoFile]);

  const handleLoadedMetadata = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const total = vid.duration;
    setDuration(total);
    setStartTime(0);
    setEndTime(Math.min(total, maxDurationSeconds));
  }, [maxDurationSeconds]);

  const selectedDuration = endTime - startTime;
  const isValid = selectedDuration >= minDurationSeconds && selectedDuration <= maxDurationSeconds;
  const validationMsg = selectedDuration < minDurationSeconds
    ? `Video must be at least ${minDurationSeconds} seconds`
    : selectedDuration > maxDurationSeconds
      ? `Video must be ${maxDurationSeconds} seconds or less`
      : null;

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStartTime(clamp(parseFloat(e.target.value), 0, endTime - 1));
  }, [endTime]);

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndTime(clamp(parseFloat(e.target.value), startTime + 1, duration));
  }, [startTime, duration]);

  const handlePreviewClip = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = startTime;
    void vid.play();
    if (trackRef.current !== null) clearInterval(trackRef.current);
    trackRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime >= endTime) {
        videoRef.current.pause();
        clearInterval(trackRef.current!);
        trackRef.current = null;
      }
    }, 100);
  }, [startTime, endTime]);

  const handleUseThisClip = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid || !isValid) return;
    const hasCapture = typeof (vid as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream === 'function';
    if (!hasCapture) { setNoCaptureStream(true); return; }
    setIsTrimming(true);
    const mimeType = selectMimeType();
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const capturedStream = (vid as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
    const recorder = new MediaRecorder(capturedStream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event: BlobEvent) => { if (event.data.size > 0) chunks.push(event.data); };
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      vid.currentTime = startTime;
      void vid.play();
      recorder.start();
      if (trackRef.current !== null) clearInterval(trackRef.current);
      trackRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.currentTime >= endTime) {
          videoRef.current.pause();
          if (recorder.state !== 'inactive') recorder.stop();
          clearInterval(trackRef.current!);
          trackRef.current = null;
        }
      }, 50);
    });
    const blob = new Blob(chunks, { type: mimeType });
    setIsTrimming(false);
    onTrimComplete(new File([blob], `trimmed.${ext}`, { type: mimeType }));
  }, [isValid, startTime, endTime, onTrimComplete]);

  const handleCancel = useCallback(() => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    onCancel();
  }, [onCancel]);

  const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-white/10" onClick={handleCancel} aria-label="Cancel trim">
          <X className="h-6 w-6" />
        </Button>
        <span className="text-sm font-medium text-white">Trim Video</span>
        <div className="h-11 w-11" />
      </div>
      <div className="flex-1 overflow-hidden">
        <video ref={videoRef} src={objectUrlRef.current ?? undefined} className="h-full w-full object-contain" onLoadedMetadata={handleLoadedMetadata} playsInline aria-label="Video trim preview" />
      </div>
      <div className="space-y-4 bg-black/90 px-4 pb-8 pt-4">
        <div className="relative h-2 rounded-full bg-white/20">
          <div className="absolute h-full rounded-full bg-primary" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/60">
            <span>Start: {Math.round(startTime)}s</span>
            <span>End: {Math.round(endTime)}s</span>
          </div>
          <input type="range" min={0} max={duration} step={0.1} value={startTime} onChange={handleStartChange} className="h-11 w-full cursor-pointer accent-primary" aria-label="Trim start point" style={{ minHeight: '44px' }} />
          <input type="range" min={0} max={duration} step={0.1} value={endTime} onChange={handleEndChange} className="h-11 w-full cursor-pointer accent-primary" aria-label="Trim end point" style={{ minHeight: '44px' }} />
        </div>
        <div className="text-center">
          <span className={cn('text-sm font-medium', isValid ? 'text-white' : 'text-destructive')}>
            Selected: {Math.round(selectedDuration)}s
          </span>
          {validationMsg && <p className="mt-1 text-xs text-destructive">{validationMsg}</p>}
        </div>
        {noCaptureStream && (
          <p className="text-center text-xs text-white/60">
            Trimming is not supported in your browser. Please record a video between {minDurationSeconds} and {maxDurationSeconds} seconds.
          </p>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={handlePreviewClip} disabled={isTrimming || noCaptureStream} aria-label="Preview selected clip">
            <Play className="mr-2 h-4 w-4" />Preview Clip
          </Button>
          <Button type="button" className="flex-1" onClick={() => void handleUseThisClip()} disabled={!isValid || isTrimming || noCaptureStream} aria-label="Use this clip">
            {isTrimming ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Trimming...</>) : (<><Scissors className="mr-2 h-4 w-4" />Use This Clip</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
