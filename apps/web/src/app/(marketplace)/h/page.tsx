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
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <div className="max-w-lg mx-auto mb-6">
            <KbSearchInput />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
            </h2>
            <Link
              href="/h"
              className="text-sm text-blue-600 hover:underline"
            >
              Clear search
            </Link>
          </div>
        </div>

        {searchResults.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">
              No articles found for &ldquo;{q}&rdquo;.
            </p>
            <Link href="/h/contact" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Contact support
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((article) => (
              <Link
                key={article.id}
                href={`/h/general/${article.slug}`}
                className="block rounded-lg border border-gray-100 bg-white px-4 py-4 hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-900">{article.title}</p>
                {article.excerpt && (
                  <p className="text-xs text-gray-500 mt-1">{article.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        )}
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
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">How can we help?</h1>
        <p className="mt-3 text-gray-500">
          Browse articles or{' '}
          <Link href="/h/contact" className="text-blue-600 hover:underline">
            contact support
          </Link>
          .
        </p>
        <div className="mt-6 max-w-lg mx-auto">
          <KbSearchInput categorySlugMap={categorySlugById} />
        </div>
      </div>

      {/* Category grid */}
      {categories.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Browse by topic</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/h/${cat.slug}`}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <span className="text-2xl">{cat.icon ?? '📋'}</span>
                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                {cat.articleCount > 0 && (
                  <p className="text-xs text-gray-400">{cat.articleCount} article{cat.articleCount !== 1 ? 's' : ''}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured articles */}
      {featured.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Popular articles</h2>
          <div className="space-y-2">
            {featured.map((article) => {
              const catSlug = article.categoryId
                ? (categorySlugById.get(article.categoryId) ?? 'general')
                : 'general';
              return (
                <Link
                  key={article.id}
                  href={`/h/${catSlug}/${article.slug}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-900">{article.title}</span>
                  <span className="text-xs text-gray-400">{article.viewCount.toLocaleString()} views</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-6 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-blue-400" />
        <h3 className="mt-3 text-sm font-semibold text-blue-900">Still need help?</h3>
        <p className="mt-1 text-sm text-blue-700">
          Our support team usually responds within one business day.
        </p>
        <Link
          href="/h/contact"
          className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
