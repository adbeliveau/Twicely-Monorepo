'use client';

import type { ComponentConfig } from '@puckeditor/core';

export interface SpacerBlockProps {
  height: string;
}

// Validate CSS height — only allow safe numeric+unit values (prevent CSS injection)
function sanitizeCssSize(value: string, fallback: string): string {
  return /^\d{1,4}(px|rem|em|vh|%)$/.test(value) ? value : fallback;
}

export function SpacerBlock({ height }: SpacerBlockProps) {
  return <div style={{ height: sanitizeCssSize(height, '40px') }} aria-hidden="true" />;
}

export const spacerBlockConfig: ComponentConfig<SpacerBlockProps> = {
  label: 'Spacer',
  defaultProps: { height: '40px' },
  fields: {
    height: { type: 'text', label: 'Height (CSS)' },
  },
  render: (props) => <SpacerBlock {...props} />,
};
