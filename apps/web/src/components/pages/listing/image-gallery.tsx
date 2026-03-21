'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@twicely/utils/cn';

interface ImageGalleryProps {
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-lg bg-muted flex items-center justify-center">
        <span className="text-muted-foreground">No image available</span>
      </div>
    );
  }

  const activeImage = images[activeIndex]!;

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        <Image
          src={activeImage.url}
          alt={activeImage.altText ?? title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                index === activeIndex
                  ? 'border-foreground'
                  : 'border-transparent hover:border-muted-foreground'
              )}
              aria-label={`View image ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            >
              <Image
                src={image.url}
                alt={image.altText ?? `${title} - Image ${index + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
