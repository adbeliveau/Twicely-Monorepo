'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createPage,
  deletePage,
  publishPage,
  unpublishPage,
} from '@/lib/actions/storefront-pages';
import type { StorefrontPageListItem } from '@/lib/queries/storefront-pages';

interface PageListClientProps {
  pages: StorefrontPageListItem[];
  maxPages: number;
}

export function PageListClient({ pages, maxPages }: PageListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');

  function handleTitleChange(value: string) {
    setTitle(value);
    // Auto-generate slug from title
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generated);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createPage({ title: title.trim(), slug: slug.trim() });
      if (!result.success) {
        setError(result.error ?? 'Failed to create page');
        return;
      }
      setTitle('');
      setSlug('');
      setShowForm(false);
      if (result.pageId) {
        router.push(`/my/selling/store/editor/${result.pageId}`);
      } else {
        router.refresh();
      }
    });
  }

  function handleTogglePublish(pageId: string, isPublished: boolean) {
    setError(null);
    startTransition(async () => {
      const result = isPublished
        ? await unpublishPage(pageId)
        : await publishPage(pageId);
      if (!result.success) setError(result.error ?? 'Failed');
      else router.refresh();
    });
  }

  function handleDelete(pageId: string, pageTitle: string) {
    if (!confirm(`Delete "${pageTitle}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePage(pageId);
      if (!result.success) setError(result.error ?? 'Failed');
      else router.refresh();
    });
  }

  const atLimit = pages.length >= maxPages;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create button */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {pages.length} / {maxPages} pages
        </p>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={atLimit || isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            New Page
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="page-title" className="block text-sm font-medium text-gray-700">
                Page Title
              </label>
              <input
                id="page-title"
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. About Us"
                maxLength={100}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="page-slug" className="block text-sm font-medium text-gray-700">
                URL Slug
              </label>
              <input
                id="page-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="e.g. about-us"
                maxLength={50}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your page will be at /st/your-store/p/{slug || 'slug'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!title.trim() || !slug.trim() || isPending}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create Page'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Page list */}
      {pages.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400">No custom pages yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Create your first page to get started
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/my/selling/store/editor/${page.id}`}
                  className="font-medium text-gray-900 hover:text-gray-700"
                >
                  {page.title}
                </Link>
                <p className="text-xs text-gray-500">/{page.slug}</p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    page.isPublished
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {page.isPublished ? 'Published' : 'Draft'}
                </span>
                <button
                  type="button"
                  onClick={() => handleTogglePublish(page.id, page.isPublished)}
                  disabled={isPending}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {page.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(page.id, page.title)}
                  disabled={isPending}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
