import Link from 'next/link';
import { SearchBar } from '@/components/shared/search-bar';

interface Props {
  trendingSearches: { label: string; query: string }[];
}

/**
 * Homepage hero section with gradient banner, search bar, and quick-action cards.
 * Visual design from V2 (public) layout; data stays server-side.
 */
export function HomepageHero({ trendingSearches }: Props) {
  return (
    <section className="bg-gray-50 dark:bg-gray-800/50">
      <div className="mx-auto max-w-[1584px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: Greeting + Search */}
          <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 p-8 text-white lg:col-span-2">
            <h1 className="text-3xl font-bold sm:text-4xl">
              The marketplace for everything you love
            </h1>
            <p className="mt-3 max-w-lg text-lg text-blue-100">
              Shop deals on fashion, electronics, collectibles, and more.
            </p>
            <div className="mt-6 w-full max-w-xl">
              <SearchBar placeholder="Search for brands, items, or styles..." />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {trendingSearches.map((item) => (
                <Link
                  key={item.query}
                  href={`/s?q=${encodeURIComponent(item.query)}`}
                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm text-white transition-colors hover:bg-white/20"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Feature cards */}
          <div className="grid grid-rows-2 gap-4">
            <Link
              href="/s?sort=deals"
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-2xl dark:bg-red-900/30">
                <span aria-hidden="true">*</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Daily Deals</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Up to 60% off top picks</p>
              </div>
              <svg className="ml-auto h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/become-seller"
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-green-100 text-2xl dark:bg-green-900/30">
                <span aria-hidden="true">$</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Sell Your Stuff</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">List in minutes, get paid fast</p>
              </div>
              <svg className="ml-auto h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
