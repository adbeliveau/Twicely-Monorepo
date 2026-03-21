import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { kbCategory } from '@twicely/db/schema';
import { asc } from 'drizzle-orm';
import { KbArticleEditor } from '@/components/helpdesk/kb-article-editor';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'New Article | Twicely Hub' };

export default async function NewKbArticlePage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return <p className="p-6 text-sm text-red-600">Access denied.</p>;
  }

  const categories = await db
    .select({ id: kbCategory.id, name: kbCategory.name })
    .from(kbCategory)
    .orderBy(asc(kbCategory.sortOrder));

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
        <h1 className="text-xl font-semibold text-primary">New Article</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new knowledge base article.</p>
      </div>

      <KbArticleEditor categories={categories} />
    </div>
  );
}
