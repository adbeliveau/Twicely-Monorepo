import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { kbArticle, kbCategory } from '@twicely/db/schema';
import { eq, asc } from 'drizzle-orm';
import { KbArticleEditor } from '@/components/helpdesk/kb-article-editor';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'Edit Article | Twicely Hub' };

type Props = { params: Promise<{ id: string }> };

export default async function EditKbArticlePage({ params }: Props) {
  const { id } = await params;
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return <p className="p-6 text-sm text-red-600">Access denied.</p>;
  }

  const [articles, categories] = await Promise.all([
    db.select().from(kbArticle).where(eq(kbArticle.id, id)).limit(1),
    db.select({ id: kbCategory.id, name: kbCategory.name, slug: kbCategory.slug })
      .from(kbCategory)
      .orderBy(asc(kbCategory.sortOrder)),
  ]);

  const article = articles[0];
  if (!article) notFound();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Link
        href="/kb"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Knowledge Base
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-primary">Edit Article</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          v{article.version} &middot; {article.status}
        </p>
      </div>

      <KbArticleEditor
        categories={categories}
        initialData={{
          id: article.id,
          categoryId: article.categoryId,
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          body: article.body,
          bodyFormat: article.bodyFormat,
          audience: article.audience,
          tags: article.tags,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          isFeatured: article.isFeatured,
          isPinned: article.isPinned,
          status: article.status,
        }}
      />
    </div>
  );
}
