'use client';

import { useState } from 'react';
import type { ComponentConfig } from '@puckeditor/core';

interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqBlockProps {
  items: FaqItem[];
}

function FaqRow({ question, answer }: FaqItem) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        className="flex w-full items-center justify-between py-4 text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="font-medium text-gray-900">{question}</span>
        <span className="ml-4 text-gray-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="pb-4 text-gray-600">{answer}</div>
      )}
    </div>
  );
}

export function FaqBlock({ items }: FaqBlockProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center text-gray-400">
        Add FAQ items in the editor
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
      <div className="px-4">
        {items.map((item, i) => (
          <FaqRow key={i} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  );
}

export const faqBlockConfig: ComponentConfig<FaqBlockProps> = {
  label: 'FAQ',
  defaultProps: {
    items: [
      { question: 'What is your return policy?', answer: 'We accept returns within 30 days.' },
    ],
  },
  fields: {
    items: {
      type: 'array',
      label: 'FAQ Items',
      arrayFields: {
        question: { type: 'text', label: 'Question' },
        answer: { type: 'textarea', label: 'Answer' },
      },
    },
  },
  render: (props) => <FaqBlock {...props} />,
};
