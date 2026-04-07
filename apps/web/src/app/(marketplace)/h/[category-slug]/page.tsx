import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getKbArticlesByCategory } from '@/lib/queries/kb-articles';
import { formatDate } from '@twicely/utils/format';
import { ChevronRight } from 'lucide-react';

type Props = { params: Promise<{ 'category-slug': string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'category-slug': slug } = await params;
  return { title: `${slug} | Help Center | Twicely` };
}

export const revalidate = 300;

export default async function HelpCategoryPage({ params }: Props) {
  const { 'category-slug': categorySlug } = await params;
  if (!categorySlug) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const isSeller = session?.user?.isSeller === true;
  const userAudience = session?.user
    ? isSeller
      ? 'SELLER'
      : 'BUYER'
    : 'ALL';

  const { category, articles } = await getKbArticlesByCategory(categorySlug, userAudience);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link href="/h" className="hover:text-gray-600">Help Center</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-700">{category.name}</span>
      </nav>

      <div className="tw-section-label">Help Center</div>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
        <em className="not-italic text-brand-500">{category.name}</em>
      </h1>
      {category.description && (
        <p className="text-gray-500 dark:text-gray-400 mb-8">{category.description}</p>
      )}

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No articles in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/h/${categorySlug}/${article.slug}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-5 py-4 hover:bg-gray-50 hover:border-gray-200 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{article.title}</p>
                {article.excerpt && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{article.excerpt}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span className="text-xs text-gray-400 hidden sm:block">
                  Updated {formatDate(article.updatedAt)}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-brand-50 border border-brand-100 p-6 text-center dark:bg-brand-900/20 dark:border-brand-900/40">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Didn&apos;t find what you were looking for?{' '}
          <Link href="/h/contact" className="font-extrabold text-brand-500 hover:underline dark:text-brand-400">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
