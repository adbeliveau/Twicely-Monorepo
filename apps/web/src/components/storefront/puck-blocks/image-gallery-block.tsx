'use client';

import type { ComponentConfig } from '@puckeditor/core';

interface GalleryImage {
  src: string;
  alt: string;
}

export interface ImageGalleryBlockProps {
  images: GalleryImage[];
  columns: '2' | '3' | '4';
}

export function ImageGalleryBlock({
  images,
  columns,
}: ImageGalleryBlockProps) {
  if (!images || images.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center text-gray-400">
        Add images in the editor
      </div>
    );
  }

  const gridClass =
    columns === '4'
      ? 'grid grid-cols-2 md:grid-cols-4'
      : columns === '3'
        ? 'grid grid-cols-2 md:grid-cols-3'
        : 'grid grid-cols-1 md:grid-cols-2';

  return (
    <div className={`${gridClass} gap-4`}>
      {images.map((img, i) => (
        <img
          key={i}
          src={img.src || 'https://placehold.co/400x400?text=Image'}
          alt={img.alt || `Gallery image ${i + 1}`}
          className="aspect-square w-full rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export const imageGalleryBlockConfig: ComponentConfig<ImageGalleryBlockProps> = {
  label: 'Image Gallery',
  defaultProps: {
    images: [],
    columns: '3',
  },
  fields: {
    images: {
      type: 'array',
      label: 'Images',
      arrayFields: {
        src: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt Text' },
      },
    },
    columns: {
      type: 'radio',
      label: 'Columns',
      options: [
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' },
      ],
    },
  },
  render: (props) => <ImageGalleryBlock {...props} />,
};
