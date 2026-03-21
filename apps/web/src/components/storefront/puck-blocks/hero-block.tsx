'use client';

import type { ComponentConfig } from '@puckeditor/core';
import { isSafeImageUrl } from './url-safety';

export interface HeroBlockProps {
  title: string;
  subtitle: string;
  backgroundImageUrl: string;
  textColor: string;
  minHeight: string;
}

export function HeroBlock({
  title,
  subtitle,
  backgroundImageUrl,
  textColor,
  minHeight,
}: HeroBlockProps) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-cover bg-center px-6"
      style={{
        backgroundImage: backgroundImageUrl && isSafeImageUrl(backgroundImageUrl)
          ? `url("${backgroundImageUrl.replace(/["\\]/g, '\\$&')}")`
          : undefined,
        backgroundColor: backgroundImageUrl ? undefined : '#f3f4f6',
        color: textColor || '#111827',
        minHeight: minHeight || '300px',
      }}
    >
      <div className="text-center">
        {title && (
          <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
        )}
        {subtitle && (
          <p className="mt-2 text-lg opacity-90">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export const heroBlockConfig: ComponentConfig<HeroBlockProps> = {
  label: 'Hero Banner',
  defaultProps: {
    title: 'Welcome to our store',
    subtitle: 'Browse our latest collection',
    backgroundImageUrl: '',
    textColor: '#111827',
    minHeight: '300px',
  },
  fields: {
    title: { type: 'text', label: 'Title' },
    subtitle: { type: 'text', label: 'Subtitle' },
    backgroundImageUrl: { type: 'text', label: 'Background Image URL' },
    textColor: { type: 'text', label: 'Text Color (hex)' },
    minHeight: { type: 'text', label: 'Min Height (CSS)' },
  },
  render: (props) => <HeroBlock {...props} />,
};
