'use client';

/**
 * Tab navigation for settings categories.
 * Client component — manages active tab state.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

interface SettingsTabProps {
  categories: string[];
  children: (activeCategory: string) => ReactNode;
}

function formatCategoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function SettingsTab({ categories, children }: SettingsTabProps) {
  const [active, setActive] = useState(categories[0] ?? '');

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={[
              'whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              active === cat
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {formatCategoryLabel(cat)}
          </button>
        ))}
      </div>
      <div className="mt-4">{children(active)}</div>
    </div>
  );
}
