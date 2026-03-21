'use client';

import type { InterestTag } from '@/lib/queries/personalization';

interface InterestPickerCardProps {
  tag: InterestTag;
  selected: boolean;
  onToggle: (slug: string) => void;
}

export function InterestPickerCard({ tag, selected, onToggle }: InterestPickerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(tag.slug)}
      className={[
        'relative rounded-xl overflow-hidden aspect-square text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
        selected
          ? 'ring-4 ring-purple-500 ring-offset-2'
          : 'ring-1 ring-gray-200 hover:ring-purple-300',
      ].join(' ')}
      aria-pressed={selected}
      aria-label={tag.label}
    >
      {/* Background — image or gradient placeholder */}
      {tag.imageUrl ? (
        <img
          src={tag.imageUrl}
          alt={tag.label}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-indigo-200" />
      )}

      {/* Label overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-2 right-2 text-white text-sm font-medium leading-tight">
        {tag.label}
      </span>

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-2 right-2 bg-purple-500 rounded-full w-6 h-6 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
