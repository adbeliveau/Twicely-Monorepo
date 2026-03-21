'use client';

import { useRef, useState, useTransition } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { uploadMeetupPhotosAction, removeMeetupPhotoAction } from '@/lib/actions/local-photo-evidence';

interface MeetupPhotoCaptureProps {
  localTransactionId: string;
  existingPhotoUrls: string[];
}

const MAX_PHOTOS = 5;

export function MeetupPhotoCapture({
  localTransactionId,
  existingPhotoUrls,
}: MeetupPhotoCaptureProps) {
  const [photoUrls, setPhotoUrls] = useState<string[]>(existingPhotoUrls);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAddClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadError(null);
    startUploadTransition(async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'meetup-photo');
      formData.append('localTransactionId', localTransactionId);

      let uploadedUrl: string | null = null;
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const json = (await res.json()) as { success: boolean; image?: { url?: string }; error?: string };
        if (!json.success || !json.image?.url) {
          setUploadError(json.error ?? 'Upload failed');
          return;
        }
        uploadedUrl = json.image.url;
      } catch {
        setUploadError('Upload failed. Please try again.');
        return;
      }

      const result = await uploadMeetupPhotosAction({
        localTransactionId,
        photoUrls: [uploadedUrl],
      });

      if (!result.success) {
        setUploadError(result.error ?? 'Failed to save photo');
        return;
      }
      setPhotoUrls(result.photoUrls ?? [...photoUrls, uploadedUrl]);
    });
  }

  function handleRemove(url: string) {
    setRemovingUrl(url);
    setUploadError(null);
    removeMeetupPhotoAction({ localTransactionId, photoUrl: url }).then((result) => {
      setRemovingUrl(null);
      if (!result.success) {
        setUploadError(result.error ?? 'Failed to remove photo');
        return;
      }
      setPhotoUrls((prev) => prev.filter((u) => u !== url));
    }).catch(() => {
      setRemovingUrl(null);
      setUploadError('Failed to remove photo. Please try again.');
    });
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Take photos before confirming</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Take condition photos of the item before confirming receipt. Photos help resolve disputes
        faster if you file a claim.
      </p>

      {/* Photo gallery */}
      {photoUrls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photoUrls.map((url) => (
            <div key={url} className="relative w-16 h-16 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Condition photo"
                className="w-full h-full object-cover rounded-md border"
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={removingUrl === url}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                aria-label="Remove photo"
              >
                {removingUrl === url
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : <X className="h-2.5 w-2.5" />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add button — hidden at max */}
      {photoUrls.length < MAX_PHOTOS && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddClick}
            disabled={isUploading}
          >
            {isUploading
              ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading…</>
              : <><Camera className="h-3 w-3 mr-1.5" />Add photo</>
            }
          </Button>
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-destructive">{uploadError}</p>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium">Optional</span> — you can confirm without photos
      </p>
    </div>
  );
}
