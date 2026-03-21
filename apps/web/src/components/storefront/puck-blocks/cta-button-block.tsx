'use client';

import type { ComponentConfig } from '@puckeditor/core';
import { isSafeHref } from './url-safety';

export interface CTAButtonBlockProps {
  text: string;
  url: string;
  variant: 'primary' | 'secondary' | 'outline';
  align: 'left' | 'center' | 'right';
}

export function CTAButtonBlock({
  text,
  url,
  variant,
  align,
}: CTAButtonBlockProps) {
  const baseClasses =
    'inline-block rounded-lg px-6 py-3 text-sm font-semibold transition-colors';
  const variantClasses =
    variant === 'primary'
      ? 'bg-gray-900 text-white hover:bg-gray-800'
      : variant === 'secondary'
        ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        : 'border-2 border-gray-900 text-gray-900 hover:bg-gray-50';

  return (
    <div className={`flex ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <a
        href={url && isSafeHref(url) ? url : '#'}
        className={`${baseClasses} ${variantClasses}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text || 'Click here'}
      </a>
    </div>
  );
}

export const ctaButtonBlockConfig: ComponentConfig<CTAButtonBlockProps> = {
  label: 'CTA Button',
  defaultProps: {
    text: 'Shop Now',
    url: '',
    variant: 'primary',
    align: 'center',
  },
  fields: {
    text: { type: 'text', label: 'Button Text' },
    url: { type: 'text', label: 'Link URL' },
    variant: {
      type: 'radio',
      label: 'Style',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
        { label: 'Outline', value: 'outline' },
      ],
    },
    align: {
      type: 'radio',
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
  },
  render: (props) => <CTAButtonBlock {...props} />,
};
