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
import { KbCategoryIcon } from '@/components/helpdesk/kb-category-icon';
import { MessageCircle, Search, Package, RotateCcw, Settings as SettingsIcon, ArrowRight } from 'lucide-react';

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
      <div className="tw-surface tw-fullwidth min-h-screen">
        <div className="mx-auto max-w-4xl px-7 py-12">
          <div className="mb-8">
            <div className="mx-auto mb-6 max-w-lg">
              <KbSearchInput />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[var(--tw-black)]">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
              </h2>
              <Link
                href="/h"
                className="text-sm font-extrabold text-[var(--mg)] hover:underline"
              >
                Clear search
              </Link>
            </div>
          </div>

          {searchResults.length === 0 ? (
            <div className="tw-empty-card">
              <Search className="mx-auto mb-4 size-16 text-[var(--tw-muted-lt)]" strokeWidth={1.5} />
              <p className="text-[var(--tw-muted)] text-sm">
                No articles found for &ldquo;{q}&rdquo;.
              </p>
              <Link href="/h/contact" className="tw-btn-sm-mg mt-4 inline-flex">
                Contact support
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((article) => (
                <Link
                  key={article.id}
                  href={`/h/general/${article.slug}`}
                  className="tw-card block"
                >
                  <p className="text-sm font-extrabold text-[var(--tw-black)]">{article.title}</p>
                  {article.excerpt && (
                    <p className="mt-1 text-xs text-[var(--tw-muted)]">{article.excerpt}</p>
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
    <div className="tw-fullwidth min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-white border-b border-[var(--tw-border)] py-14">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="tw-hero-shell">
            <div className="tw-hero-copy text-center" style={{ padding: '56px 40px' }}>
              <div className="tw-eyebrow mx-auto">
                <span className="tw-eyebrow-dot" />
                Help Center
              </div>
              <h1 className="tw-hero-h1 mx-auto" style={{ maxWidth: '14ch' }}>
                How can we <span className="text-[var(--mg)]">help</span>?
              </h1>
              <p className="text-[17px] text-[var(--tw-muted)] leading-relaxed mb-7 max-w-[52ch] mx-auto">
                Browse articles, search the knowledge base, or{' '}
                <Link href="/h/contact" className="font-bold text-[var(--mg)] underline hover:no-underline">
                  contact support
                </Link>
                .
              </p>
              <div className="mx-auto max-w-lg">
                <KbSearchInput categorySlugMap={categorySlugById} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-12">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 max-w-4xl mx-auto">
            <Link href="/my/buying/orders" className="tw-tile">
              <div className="tw-tile-icon">
                <Package className="size-5" strokeWidth={2} />
              </div>
              <span className="text-sm font-extrabold text-[var(--tw-black)]">My Orders</span>
            </Link>
            <Link href="/my/buying/orders" className="tw-tile">
              <div className="tw-tile-icon">
                <RotateCcw className="size-5" strokeWidth={2} />
              </div>
              <span className="text-sm font-extrabold text-[var(--tw-black)]">Returns</span>
            </Link>
            <Link href="/h/contact" className="tw-tile">
              <div className="tw-tile-icon">
                <MessageCircle className="size-5" strokeWidth={2} />
              </div>
              <span className="text-sm font-extrabold text-[var(--tw-black)]">My Cases</span>
            </Link>
            <Link href="/my/settings" className="tw-tile">
              <div className="tw-tile-icon">
                <SettingsIcon className="size-5" strokeWidth={2} />
              </div>
              <span className="text-sm font-extrabold text-[var(--tw-black)]">Settings</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Category grid */}
      {categories.length > 0 && (
        <section className="py-12 bg-[var(--tw-bg)]">
          <div className="mx-auto max-w-[1380px] px-7">
            <div className="text-center mb-8">
              <div className="tw-section-label">Browse by topic</div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
                Find <em className="not-italic text-[var(--mg)]">answers</em>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 max-w-5xl mx-auto">
              {categories.map((cat) => (
                <Link key={cat.id} href={`/h/${cat.slug}`} className="tw-tile">
                  <div className="tw-tile-icon">
                    <KbCategoryIcon name={cat.icon} className="size-5" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-extrabold text-[var(--tw-black)]">{cat.name}</p>
                  {cat.articleCount > 0 && (
                    <p className="text-xs text-[var(--tw-muted-lt)]">
                      {cat.articleCount} article{cat.articleCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured articles */}
      {featured.length > 0 && (
        <section className="py-12">
          <div className="mx-auto max-w-[1380px] px-7">
            <div className="text-center mb-8">
              <div className="tw-section-label">Popular</div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
                Most-read <em className="not-italic text-[var(--mg)]">articles</em>
              </h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-2">
              {featured.map((article) => {
                const catSlug = article.categoryId
                  ? (categorySlugById.get(article.categoryId) ?? 'general')
                  : 'general';
                return (
                  <Link
                    key={article.id}
                    href={`/h/${catSlug}/${article.slug}`}
                    className="tw-card flex items-center justify-between"
                  >
                    <span className="text-sm font-extrabold text-[var(--tw-black)]">{article.title}</span>
                    <span className="text-xs text-[var(--tw-muted-lt)] flex items-center gap-2">
                      {article.viewCount.toLocaleString()} views
                      <ArrowRight className="size-3.5 text-[var(--mg)]" strokeWidth={2.5} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-12 pb-20">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="tw-feature-card text-center max-w-3xl mx-auto">
            <div className="tw-trust-icon-wrap mx-auto mb-4">
              <MessageCircle className="size-5" strokeWidth={2} />
            </div>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--tw-black)]">
              Still need <em className="not-italic text-[var(--mg)]">help</em>?
            </h3>
            <p className="mt-2 text-[var(--tw-muted)]">
              Our support team usually responds within one business day.
            </p>
            <Link href="/h/contact" className="tw-btn-mg mt-6 inline-flex">
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
