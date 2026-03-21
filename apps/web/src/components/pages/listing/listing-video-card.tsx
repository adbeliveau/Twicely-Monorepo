'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { VideoUploader } from './video-uploader';
import { useCameraSupport } from '@/hooks/use-camera-support';

interface VideoData {
  url: string;
  thumbUrl: string;
  durationSeconds: number;
}

interface ListingVideoCardProps {
  videoUrl: string | null;
  videoThumbUrl: string | null;
  videoDurationSeconds: number | null;
  onVideoChange: (video: VideoData | null) => void;
  disabled?: boolean;
}

export function ListingVideoCard({
  videoUrl,
  videoThumbUrl,
  videoDurationSeconds,
  onVideoChange,
  disabled,
}: ListingVideoCardProps) {
  const { isSupported: cameraSupported } = useCameraSupport();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video (optional)</CardTitle>
      </CardHeader>
      <CardContent>
        <VideoUploader
          videoUrl={videoUrl}
          videoThumbUrl={videoThumbUrl}
          videoDurationSeconds={videoDurationSeconds}
          onVideoChange={onVideoChange}
          disabled={disabled}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Add a short video to show your item in motion. Try-on, condition walkthrough, or detail shots.
          {cameraSupported && ' Record directly or upload from your gallery.'}
        </p>
      </CardContent>
    </Card>
  );
}
