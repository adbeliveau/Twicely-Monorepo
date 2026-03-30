import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import {
  getPublicKbCategories,
  getFeaturedKbArticles,
  searchKbArticles,
} from '@/lib/queries/kb-articles';
import { KbSearchInput } from '@/components/helpdesk/kb-search-input';
import { MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Center | Twicely',
  description: 'Find answers to common questions about buying, selling, and using Twicely.',
};

export const revalidate = 300;

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function HelpCenterPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  const { q } = await searchParams;

  const isSeller = session?.user?.isSeller === true;
  const userAudience = session?.user
    ? isSeller
      ? 'SELLER'
      : 'BUYER'
    : null;

  // Search results mode
  if (q && q.trim().length > 0) {
    const searchResults = await searchKbArticles(q.trim(), userAudience);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="mb-8">
            <div className="mx-auto mb-6 max-w-lg">
              <KbSearchInput />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
              </h2>
              <Link
                href="/h"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Clear search
              </Link>
            </div>
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow-sm dark:bg-gray-800">
              <svg className="mx-auto mb-4 h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500 text-sm dark:text-gray-400">
                No articles found for &ldquo;{q}&rdquo;.
              </p>
              <Link href="/h/contact" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                Contact support
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((article) => (
                <Link
                  key={article.id}
                  href={`/h/general/${article.slug}`}
                  className="block rounded-lg border border-gray-100 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{article.title}</p>
                  {article.excerpt && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{article.excerpt}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal home page mode
  const [categories, featured] = await Promise.all([
    getPublicKbCategories(userAudience),
    getFeaturedKbArticles(userAudience),
  ]);

  const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">How can we help?</h1>
          <p className="mt-3 text-lg text-blue-100">
            Browse articles or{' '}
            <Link href="/h/contact" className="font-medium text-white underline hover:no-underline">
              contact support
            </Link>
            .
          </p>
          <div className="mx-auto mt-6 max-w-lg">
            <KbSearchInput categorySlugMap={categorySlugById} />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Link
            href="/my/buying/orders"
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-sm font-medium text-gray-900 dark:text-white">My Orders</span>
          </Link>
          <Link
            href="/my/buying/orders"
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Returns</span>
          </Link>
          <Link
            href="/h/contact"
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <MessageCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">My Cases</span>
          </Link>
          <Link
            href="/my/settings"
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Settings</span>
          </Link>
        </div>
      </div>

      {/* Category grid */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-12">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Browse by topic</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/h/${cat.slug}`}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <span className="text-2xl">{cat.icon ?? '*'}</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</p>
                {cat.articleCount > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {cat.articleCount} article{cat.articleCount !== 1 ? 's' : ''}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured articles */}
      {featured.length > 0 && (
        <section className="bg-gray-50 dark:bg-gray-800/50">
          <div className="mx-auto max-w-4xl px-4 py-12">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Popular articles</h2>
            <div className="space-y-2">
              {featured.map((article) => {
                const catSlug = article.categoryId
                  ? (categorySlugById.get(article.categoryId) ?? 'general')
                  : 'general';
                return (
                  <Link
                    key={article.id}
                    href={`/h/${catSlug}/${article.slug}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className="text-sm text-gray-900 dark:text-white">{article.title}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{article.viewCount.toLocaleString()} views</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-8 text-center dark:from-blue-900/20 dark:to-purple-900/20">
          <MessageCircle className="mx-auto h-10 w-10 text-blue-500 dark:text-blue-400" />
          <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">Still need help?</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Our support team usually responds within one business day.
          </p>
          <Link
            href="/h/contact"
            className="mt-5 inline-flex rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
