'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@twicely/utils';
import { ImagePlus } from 'lucide-react';
import type { UploadedImage } from '@/types/upload';
import { MAX_IMAGES, MAX_FILE_SIZE, ALLOWED_TYPES } from '@/lib/upload/validate';
import { ImageUploaderPreview } from './image-uploader-preview';

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ images, onChange, disabled }: ImageUploaderProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);

  // Keep ref in sync with prop
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const canAddMore = images.length < MAX_IMAGES;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;

      const fileArray = Array.from(files);
      const remainingSlots = MAX_IMAGES - imagesRef.current.length;
      const filesToUpload = fileArray.slice(0, remainingSlots);

      for (const file of filesToUpload) {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          continue;
        }

        // Create temporary ID for tracking upload
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const preview = URL.createObjectURL(file);

        // Add placeholder image
        const placeholderImage: UploadedImage = {
          id: tempId,
          url: '',
          file,
          preview,
          position: imagesRef.current.length,
        };

        const newImages = [...imagesRef.current, placeholderImage];
        imagesRef.current = newImages;
        onChange(newImages);
        setUploading((prev) => new Set(prev).add(tempId));

        // Upload file
        try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (result.success && result.image) {
            // Replace placeholder with uploaded image
            const updatedImages = imagesRef.current.map((img) =>
              img.id === tempId
                ? {
                    ...result.image,
                    preview,
                    position: img.position,
                  }
                : img
            );
            imagesRef.current = updatedImages;
            onChange(updatedImages);
          } else {
            // Remove failed upload
            const filteredImages = imagesRef.current.filter((img) => img.id !== tempId);
            imagesRef.current = filteredImages;
            onChange(filteredImages);
            URL.revokeObjectURL(preview);
          }
        } catch {
          // Remove failed upload
          const filteredImages = imagesRef.current.filter((img) => img.id !== tempId);
          imagesRef.current = filteredImages;
          onChange(filteredImages);
          URL.revokeObjectURL(preview);
        } finally {
          setUploading((prev) => {
            const next = new Set(prev);
            next.delete(tempId);
            return next;
          });
        }
      }
    },
    [onChange, disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);

      if (disabled || !canAddMore) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, canAddMore, handleFiles]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && canAddMore) {
        setIsDraggingOver(true);
      }
    },
    [disabled, canAddMore]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled && canAddMore) {
      fileInputRef.current?.click();
    }
  }, [disabled, canAddMore]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleRemove = useCallback(
    (id: string) => {
      const image = images.find((img) => img.id === id);
      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }

      const newImages = images
        .filter((img) => img.id !== id)
        .map((img, index) => ({ ...img, position: index }));

      onChange(newImages);
    },
    [images, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled || !canAddMore ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDraggingOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          (disabled || !canAddMore) && 'cursor-not-allowed opacity-50'
        )}
      >
        <ImagePlus className="h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {canAddMore ? 'Drop images here or click to upload' : 'Maximum images reached'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPEG, PNG, or WebP up to 20MB ({images.length}/{MAX_IMAGES})
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || !canAddMore}
      />

      {/* Image preview grid */}
      <ImageUploaderPreview
        images={images}
        uploading={uploading}
        disabled={disabled}
        onRemove={handleRemove}
        onChange={onChange}
      />
    </div>
  );
}
