'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { InterestTag } from '@/lib/queries/personalization';
import { saveUserInterestsAction } from '@/lib/actions/personalization';
import { InterestPickerCard } from './interest-picker-card';

interface InterestPickerProps {
  tags: InterestTag[];
}

const GROUP_LABELS: Record<string, string> = {
  fashion: 'Fashion',
  electronics: 'Electronics',
  sports: 'Sports',
  home: 'Home',
  collectibles: 'Collectibles',
  lifestyle: 'Lifestyle',
};

const GROUP_ORDER = ['fashion', 'electronics', 'sports', 'home', 'collectibles', 'lifestyle'];

function groupTags(tags: InterestTag[]): [string, InterestTag[]][] {
  const map = new Map<string, InterestTag[]>();

  for (const tag of tags) {
    const group = tag.group;
    if (!map.has(group)) {
      map.set(group, []);
    }
    map.get(group)!.push(tag);
  }

  // Sort groups by canonical order, then any unknown groups alphabetically
  const sorted: [string, InterestTag[]][] = [];
  for (const key of GROUP_ORDER) {
    if (map.has(key)) {
      sorted.push([key, map.get(key)!]);
    }
  }
  for (const [key, val] of map.entries()) {
    if (!GROUP_ORDER.includes(key)) {
      sorted.push([key, val]);
    }
  }

  return sorted;
}

export function InterestPicker({ tags }: InterestPickerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groups = groupTags(tags);
  const selectedCount = selected.size;
  const canSubmit = selectedCount >= 2 && !isPending;

  function toggleTag(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const result = await saveUserInterestsAction({ tagSlugs: Array.from(selected) });
      if (!result.success) {
        setError(result.error ?? 'Something went wrong. Please try again.');
        return;
      }
      router.push('/');
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">What brings you to Twicely?</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pick at least 2 interests to personalize your feed
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            Skip for now
          </Link>
        </div>
      </div>

      {/* Interest Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {groups.map(([group, groupTags]) => (
            <section key={group}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {GROUP_LABELS[group] ?? group}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupTags.map((tag) => (
                  <InterestPickerCard
                    key={tag.slug}
                    tag={tag}
                    selected={selected.has(tag.slug)}
                    onToggle={toggleTag}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-2">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canSubmit}
            className="w-full max-w-sm py-3 px-6 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending
              ? 'Saving...'
              : selectedCount > 0
              ? `Continue (${selectedCount} selected)`
              : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
