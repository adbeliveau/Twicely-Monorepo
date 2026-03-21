import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminKbArticles, getAdminKbCategories } from '@/lib/queries/kb-admin-queries';
import { formatDate } from '@twicely/utils/format';
import { KbArticleFilters } from '@/components/admin/kb-article-filters';
import { FileText, Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Knowledge Base | Twicely Hub' };

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  REVIEW: 'bg-amber-100 text-amber-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KnowledgeBasePage({ searchParams }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbArticle')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_LEAD role required.</p>;
  }

  const raw = await searchParams;
  function param(key: string): string | undefined {
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
  }

  const status = param('status') as 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  const categoryId = param('categoryId');
  const audience = param('audience') as 'ALL' | 'BUYER' | 'SELLER' | 'AGENT_ONLY' | undefined;
  const search = param('search');

  const [allArticles, categories] = await Promise.all([
    getAdminKbArticles({ status, categoryId, audience }),
    getAdminKbCategories(),
  ]);

  const articles = search
    ? allArticles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : allArticles;

  function helpfulPct(yes: number, no: number): string {
    const total = yes + no;
    if (total === 0) return '--';
    return `${Math.round((yes / total) * 100)}%`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">Knowledge Base</h1>
          <p className="mt-0.5 text-sm text-gray-500">{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/kb/categories" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Manage Categories
          </Link>
          <Link
            href="/kb/new"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Article
          </Link>
        </div>
      </div>

      <KbArticleFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        currentStatus={status}
        currentCategoryId={categoryId}
        currentAudience={audience}
        currentSearch={search}
      />

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-600">No articles yet</p>
          <p className="mt-1 text-sm text-gray-400">Create your first knowledge base article.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Audience</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Views</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Helpful %</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Updated</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Author</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/kb/${article.id}/edit`} className="font-medium text-gray-900 hover:text-blue-600">
                      {article.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 text-xs">
                    {article.categoryName ?? 'Uncategorized'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[article.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {article.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{article.audience}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{article.viewCount.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {helpfulPct(article.helpfulYes, article.helpfulNo)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDate(article.updatedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 text-xs">
                    {article.authorName ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/kb/${article.id}/edit`} className="text-xs font-medium text-blue-600 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
