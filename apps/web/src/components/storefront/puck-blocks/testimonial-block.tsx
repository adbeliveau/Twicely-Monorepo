'use client';

import type { ComponentConfig } from '@puckeditor/core';

export interface TestimonialBlockProps {
  quote: string;
  author: string;
  role: string;
}

export function TestimonialBlock({
  quote,
  author,
  role,
}: TestimonialBlockProps) {
  return (
    <blockquote className="rounded-lg border-l-4 border-gray-300 bg-gray-50 p-6">
      <p className="text-lg italic text-gray-700">
        &ldquo;{quote}&rdquo;
      </p>
      <footer className="mt-3">
        <span className="font-semibold text-gray-900">{author}</span>
        {role && (
          <span className="ml-2 text-sm text-gray-500">&mdash; {role}</span>
        )}
      </footer>
    </blockquote>
  );
}

export const testimonialBlockConfig: ComponentConfig<TestimonialBlockProps> = {
  label: 'Testimonial',
  defaultProps: {
    quote: 'This is an amazing store!',
    author: 'Happy Customer',
    role: '',
  },
  fields: {
    quote: { type: 'textarea', label: 'Quote' },
    author: { type: 'text', label: 'Author Name' },
    role: { type: 'text', label: 'Role / Title (optional)' },
  },
  render: (props) => <TestimonialBlock {...props} />,
};
