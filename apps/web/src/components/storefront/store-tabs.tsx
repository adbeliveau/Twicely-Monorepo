'use client';

import { cn } from '@twicely/utils/cn';

interface StoreTabsProps {
  categories: { id: string; name: string; slug: string }[];
  hasFeatured: boolean;
  accentColor: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function StoreTabs({
  categories,
  hasFeatured,
  accentColor,
  activeTab,
  onTabChange,
}: StoreTabsProps) {
  const tabs = [
    { id: 'all', label: 'All Items' },
    ...(hasFeatured ? [{ id: 'featured', label: 'Featured' }] : []),
    ...categories.map((cat) => ({ id: cat.slug, label: cat.name })),
  ];

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <nav className="flex gap-6 border-b min-w-max" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative py-3 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
