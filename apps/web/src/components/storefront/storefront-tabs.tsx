'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface CustomPageTab {
  title: string;
  slug: string;
}

interface StorefrontTabsProps {
  slug: string;
  customPages?: CustomPageTab[];
}

const staticTabs = [
  { label: 'Shop', path: '' },
  { label: 'About', path: '/about' },
  { label: 'Reviews', path: '/reviews' },
] as const;

export function StorefrontTabs({ slug, customPages }: StorefrontTabsProps) {
  const pathname = usePathname();
  const basePath = `/st/${slug}`;

  function isActive(tabPath: string) {
    const fullPath = `${basePath}${tabPath}`;
    // Exact match for Shop tab, prefix match for others
    if (tabPath === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(fullPath);
  }

  // Build dynamic tabs from custom pages
  const dynamicTabs = (customPages ?? []).map((page) => ({
    label: page.title,
    path: `/p/${page.slug}`,
  }));

  const allTabs = [...staticTabs, ...dynamicTabs];

  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-6" aria-label="Store navigation">
          {allTabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                href={`${basePath}${tab.path}`}
                className={`relative py-3 text-sm transition-colors ${
                  active
                    ? 'font-semibold text-gray-900'
                    : 'font-medium text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {active && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5"
                    style={{ backgroundColor: 'var(--store-accent, #7C3AED)' }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
