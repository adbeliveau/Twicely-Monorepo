import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getKbArticleBySlug } from '@/lib/queries/kb-articles';
import { formatDate } from '@twicely/utils/format';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { ArticleFeedbackForm } from '@/components/helpdesk/article-feedback-form';
import { MarkdownRenderer } from '@/components/helpdesk/markdown-renderer';

type Props = {
  params: Promise<{ 'category-slug': string; 'article-slug': string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'article-slug': slug } = await params;
  const article = await getKbArticleBySlug(slug);
  if (!article) return { title: 'Article Not Found | Twicely Help' };

  return {
    title: `${article.metaTitle ?? article.title} | Twicely Help`,
    description: article.metaDescription ?? article.excerpt ?? undefined,
  };
}

export const revalidate = 300;

export default async function HelpArticlePage({ params }: Props) {
  const { 'category-slug': categorySlug, 'article-slug': articleSlug } = await params;
  if (!categorySlug || !articleSlug) notFound();

  const article = await getKbArticleBySlug(articleSlug);
  if (!article) notFound();

  // AGENT_ONLY articles are not visible on the public help center
  if (article.audience === 'AGENT_ONLY') notFound();

  // Only show PUBLISHED articles publicly
  if (article.status !== 'PUBLISHED') notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt ?? undefined,
    dateModified: article.updatedAt.toISOString(),
    datePublished: article.publishedAt?.toISOString(),
    publisher: {
      '@type': 'Organization',
      name: 'Twicely',
      url: 'https://twicely.co',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/') }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
          <Link href="/h" className="hover:text-gray-600">Help Center</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/h/${categorySlug}`} className="hover:text-gray-600">
            {categorySlug}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-700 truncate max-w-xs">{article.title}</span>
        </nav>

        {/* Article */}
        <article>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{article.title}</h1>
          <p className="text-xs text-gray-400 mb-8">
            Last updated {formatDate(article.updatedAt)}
          </p>

          <MarkdownRenderer content={article.body} />
        </article>

        {/* Related articles */}
        {article.relatedArticles.length > 0 && (
          <section className="mt-10 border-t border-gray-200 pt-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Related articles</h2>
            <ul className="space-y-2">
              {article.relatedArticles.map((rel) => (
                <li key={rel.id}>
                  <Link
                    href={`/h/${categorySlug}/${rel.slug}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {rel.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Feedback */}
        <div className="mt-10 border-t border-gray-200 pt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            Was this article helpful?
          </h2>
          <ArticleFeedbackForm articleId={article.id} />
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-lg bg-gray-50 border border-gray-200 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-600">Still need help?</p>
          </div>
          <Link
            href="/h/contact"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </>
  );
}
