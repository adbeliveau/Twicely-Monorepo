'use client';

import DOMPurify from 'dompurify';
import type { ComponentConfig } from '@puckeditor/core';

export interface RichTextBlockProps {
  content: string;
}

export function RichTextBlock({ content }: RichTextBlockProps) {
  const clean = DOMPurify.sanitize(content);
  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export const richTextBlockConfig: ComponentConfig<RichTextBlockProps> = {
  label: 'Rich Text',
  defaultProps: {
    content: '<p>Enter your content here...</p>',
  },
  fields: {
    content: { type: 'textarea', label: 'HTML Content' },
  },
  render: (props) => <RichTextBlock {...props} />,
};
