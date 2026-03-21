'use client';

import type { ComponentConfig } from '@puckeditor/core';
import { isSafeHref } from './url-safety';

export interface ImageBlockProps {
  src: string;
  alt: string;
  linkUrl: string;
  rounded: boolean;
}

export function ImageBlock({ src, alt, linkUrl, rounded }: ImageBlockProps) {
  const img = (
    <img
      src={src || 'https://placehold.co/800x400?text=Image'}
      alt={alt || 'Image'}
      className={`w-full object-cover ${rounded ? 'rounded-lg' : ''}`}
    />
  );

  if (linkUrl && isSafeHref(linkUrl)) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer">
        {img}
      </a>
    );
  }

  return img;
}

export const imageBlockConfig: ComponentConfig<ImageBlockProps> = {
  label: 'Image',
  defaultProps: {
    src: '',
    alt: '',
    linkUrl: '',
    rounded: true,
  },
  fields: {
    src: { type: 'text', label: 'Image URL' },
    alt: { type: 'text', label: 'Alt Text' },
    linkUrl: { type: 'text', label: 'Link URL (optional)' },
    rounded: {
      type: 'radio',
      label: 'Rounded Corners',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  render: (props) => <ImageBlock {...props} />,
};
