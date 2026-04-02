'use client';

import { useRef, useState, useEffect } from 'react';

interface ListingVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl: string | null;
  title: string;
  durationSeconds: number | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ListingVideoPlayer({
  videoUrl,
  thumbnailUrl,
  title,
  durationSeconds,
}: ListingVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync muted state to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const handleClick = () => {
    setMuted((prev) => !prev);
  };

  if (reducedMotion) {
    // prefers-reduced-motion: show poster image with a play button overlay
    return (
      <div
        className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-black"
        aria-label={`Item video for ${title}`}
      >
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={`Video thumbnail for ${title}`}
            className="h-full w-full object-contain"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60">
            <svg className="ml-1 h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {durationSeconds !== null && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
            {formatDuration(durationSeconds)}
          </div>
        )}
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0"
          aria-label={`Play video for ${title}`}
        />
      </div>
    );
  }

  return (
    <div
      className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-black"
      aria-label={`Item video for ${title}`}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        controls
        className="h-full w-full object-contain"
        aria-label={`Item video for ${title}`}
        onClick={handleClick}
      />
      {durationSeconds !== null && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
          {formatDuration(durationSeconds)}
        </div>
      )}
    </div>
  );
}
