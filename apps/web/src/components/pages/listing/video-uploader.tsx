'use client';

import { useRef, useState, useCallback } from 'react';
import { X, Video, Loader2, Camera, Upload } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { cn } from '@twicely/utils';
import { useCameraSupport } from '@/hooks/use-camera-support';
import { VideoRecorder } from './video-recorder';
import { VideoTrimmer } from './video-trimmer';

interface VideoData {
  url: string;
  thumbUrl: string;
  durationSeconds: number;
}

interface VideoUploaderProps {
  videoUrl: string | null;
  videoThumbUrl: string | null;
  videoDurationSeconds: number | null;
  onVideoChange: (video: VideoData | null) => void;
  disabled?: boolean;
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MIN_DURATION = 15;
const MAX_DURATION = 60;
const ACCEPTED_TYPES = 'video/mp4,video/quicktime,video/webm';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function getVideoDuration(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  const vid = document.createElement('video');
  vid.preload = 'metadata';
  vid.muted = true;
  vid.src = objectUrl;
  await new Promise<void>((res) => { vid.onloadeddata = () => res(); });
  const dur = Math.round(vid.duration);
  URL.revokeObjectURL(objectUrl);
  return dur;
}

export function VideoUploader({ videoUrl, videoThumbUrl, videoDurationSeconds, onVideoChange, disabled }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [trimFile, setTrimFile] = useState<File | null>(null);
  const { isSupported: cameraSupported } = useCameraSupport();

  const extractThumbnail = useCallback((videoElement: HTMLVideoElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      videoElement.currentTime = Math.min(0.5, videoElement.duration);
      videoElement.onseeked = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1280;
        const scale = videoElement.videoWidth > maxW ? maxW / videoElement.videoWidth : 1;
        canvas.width = Math.floor(videoElement.videoWidth * scale);
        canvas.height = Math.floor(videoElement.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Could not extract thumbnail')); return; }
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };
    }), []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > MAX_VIDEO_SIZE) { setError('Video must be less than 100MB'); return; }
    const objectUrl = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata'; vid.muted = true; vid.src = objectUrl;
    await new Promise<void>((res) => { vid.onloadeddata = () => res(); });
    const durationSeconds = Math.round(vid.duration);
    if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
      URL.revokeObjectURL(objectUrl);
      setError(`Video must be between ${MIN_DURATION} and ${MAX_DURATION} seconds`);
      return;
    }
    setUploading(true); setUploadProgress('Uploading video...');
    try {
      const videoForm = new FormData();
      videoForm.append('file', file); videoForm.append('type', 'video'); videoForm.append('durationSeconds', String(durationSeconds));
      const videoRes = await fetch('/api/upload', { method: 'POST', body: videoForm });
      const videoData = (await videoRes.json()) as { success: boolean; video?: { url: string }; error?: string };
      if (!videoData.success || !videoData.video) throw new Error(videoData.error ?? 'Video upload failed');
      setUploadProgress('Extracting thumbnail...');
      const thumbBlob = await extractThumbnail(vid);
      URL.revokeObjectURL(objectUrl);
      setUploadProgress('Uploading thumbnail...');
      const urlParts = videoData.video.url.split('/');
      const listingIdFromUrl = urlParts[urlParts.indexOf('listings') + 1] ?? '';
      const thumbForm = new FormData();
      thumbForm.append('file', new File([thumbBlob], 'thumb.jpg', { type: 'image/jpeg' }));
      thumbForm.append('type', 'video-thumbnail'); thumbForm.append('listingId', listingIdFromUrl);
      const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbForm });
      const thumbData = (await thumbRes.json()) as { success: boolean; image?: { url: string }; error?: string };
      if (!thumbData.success || !thumbData.image) throw new Error(thumbData.error ?? 'Thumbnail upload failed');
      onVideoChange({ url: videoData.video.url, thumbUrl: thumbData.image.url, durationSeconds });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false); setUploadProgress(null);
    }
  }, [extractThumbnail, onVideoChange]);

  const handleRecordingComplete = useCallback(async (file: File) => {
    setRecorderOpen(false);
    const dur = await getVideoDuration(file);
    if (dur > MAX_DURATION) { setTrimFile(file); } else { void handleFile(file); }
  }, [handleFile]);

  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dur = await getVideoDuration(file);
    if (dur > MAX_DURATION) { setTrimFile(file); } else { void handleFile(file); }
  }, [handleFile]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dur = await getVideoDuration(file);
    if (dur > MAX_DURATION) { setTrimFile(file); } else { void handleFile(file); }
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    onVideoChange(null); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [onVideoChange]);

  const handleTrimComplete = useCallback((f: File) => { setTrimFile(null); void handleFile(f); }, [handleFile]);
  const handleTrimCancel = useCallback(() => { setTrimFile(null); setError(null); }, []);

  if (recorderOpen) {
    return <VideoRecorder maxDurationSeconds={MAX_DURATION} minDurationSeconds={MIN_DURATION} onRecordingComplete={(f) => void handleRecordingComplete(f)} onCancel={() => setRecorderOpen(false)} />;
  }
  if (trimFile) {
    return <VideoTrimmer videoFile={trimFile} minDurationSeconds={MIN_DURATION} maxDurationSeconds={MAX_DURATION} onTrimComplete={handleTrimComplete} onCancel={handleTrimCancel} />;
  }
  if (videoUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video src={videoUrl} poster={videoThumbUrl ?? undefined} controls playsInline className="w-full" aria-label="Uploaded listing video" />
        {videoDurationSeconds !== null && (
          <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">{formatDuration(videoDurationSeconds)}</div>
        )}
        <Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={handleRemove} disabled={disabled} aria-label="Remove video">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const dropZoneClass = cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors', uploading || disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/50 hover:bg-muted/30');
  const btnClass = (extra?: boolean) => cn('flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors', (extra ?? false) || disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/50 hover:bg-muted/30');

  return (
    <div>
      {cameraSupported ? (
        <div className="flex gap-3">
          <button type="button" className={btnClass()} onClick={() => !disabled && setRecorderOpen(true)} disabled={disabled} aria-label="Record video">
            <Camera className="h-7 w-7 text-muted-foreground" />
            <span className="text-sm font-medium">Record Video</span>
          </button>
          <button type="button" className={btnClass(uploading)} onClick={() => !uploading && !disabled && inputRef.current?.click()} disabled={uploading || disabled} aria-label="Upload video from gallery">
            {uploading ? (<><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">{uploadProgress}</span></>) : (<><Upload className="h-7 w-7 text-muted-foreground" /><span className="text-sm font-medium">Upload from Gallery</span></>)}
          </button>
        </div>
      ) : (
        <div className={dropZoneClass} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => !uploading && !disabled && inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }} aria-label="Video upload drop zone">
          {uploading ? (<><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">{uploadProgress}</p></>) : (<><Video className="h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Drop a video here or click to upload</p><p className="text-xs text-muted-foreground">MP4, MOV, or WebM up to 100MB, 15–60 seconds</p></>)}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="sr-only" onChange={(e) => void handleInputChange(e)} disabled={uploading || disabled} aria-hidden="true" />
    </div>
  );
}
