import { Camera, ImageOff } from 'lucide-react';
import Image from 'next/image';
import type { MeetupPhotoContext } from '@/lib/queries/local-transaction';

interface MeetupPhotoContextCardProps {
  context: MeetupPhotoContext;
}

const FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function MeetupPhotoContextCard({ context }: MeetupPhotoContextCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">Photo Evidence</span>
      </div>

      {context.hasPhotos ? (
        <>
          <p className="text-xs text-muted-foreground">
            {context.photoUrls.length} photo{context.photoUrls.length !== 1 ? 's' : ''} taken
            {context.photosAt ? ` on ${FMT.format(context.photosAt)}` : ''}
          </p>
          <div className="flex gap-2 flex-wrap">
            {context.photoUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={url}
                  alt="Meetup condition photo"
                  width={64}
                  height={64}
                  className="object-cover rounded-md border hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
          <ImageOff className="h-4 w-4 shrink-0" />
          <span>No condition photos were taken at this meetup</span>
        </div>
      )}
    </div>
  );
}
