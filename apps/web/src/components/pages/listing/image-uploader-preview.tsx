'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { cn } from '@twicely/utils';
import { Button } from '@twicely/ui/button';
import { X, GripVertical, Loader2 } from 'lucide-react';
import type { UploadedImage } from '@/types/upload';

interface ImageUploaderPreviewProps {
  images: UploadedImage[];
  uploading: Set<string>;
  disabled?: boolean;
  onRemove: (id: string) => void;
  onChange: (images: UploadedImage[]) => void;
}

export function ImageUploaderPreview({
  images,
  uploading,
  disabled,
  onRemove,
  onChange,
}: ImageUploaderPreviewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (disabled) return;
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    },
    [disabled]
  );

  const handleDragOverItem = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      // Reorder images
      const newImages = [...images];
      const draggedImage = newImages[draggedIndex];
      if (!draggedImage) return;

      newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedImage);

      // Update positions
      const updatedImages = newImages.map((img, i) => ({ ...img, position: i }));
      onChange(updatedImages);
      setDraggedIndex(index);
    },
    [draggedIndex, images, onChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {images.map((image, index) => {
        const isUploading = uploading.has(image.id);
        const imageSrc = image.preview || image.url;

        return (
          <div
            key={image.id}
            draggable={!disabled && !isUploading}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOverItem(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'group relative aspect-square overflow-hidden rounded-lg border bg-muted',
              draggedIndex === index && 'opacity-50'
            )}
          >
            {imageSrc && (
              <Image
                src={imageSrc}
                alt={`Image ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />
            )}

            {/* Loading overlay */}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {/* Position badge */}
            <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-xs font-medium">
              {index + 1}
            </div>

            {/* Cover photo badge */}
            {index === 0 && (
              <div className="absolute bottom-2 left-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                Cover
              </div>
            )}

            {/* Actions */}
            {!isUploading && (
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-7 w-7 cursor-grab items-center justify-center rounded bg-background/90 active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 bg-background/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(image.id);
                  }}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove image</span>
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
