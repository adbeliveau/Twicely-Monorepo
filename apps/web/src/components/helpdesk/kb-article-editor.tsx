'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createKbArticle, updateKbArticle } from '@/lib/actions/kb-articles';
import { KbArticleToolbar } from './kb-article-toolbar';

interface Category { id: string; name: string; slug?: string; }

interface InitialData {
  id?: string;
  categoryId?: string | null;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  body?: string;
  bodyFormat?: string;
  audience?: string;
  tags?: string[];
  searchKeywords?: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  isFeatured?: boolean;
  isPinned?: boolean;
  status?: string;
}

interface KbArticleEditorProps {
  categories: Category[];
  initialData?: InitialData;
}

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'All Users' },
  { value: 'BUYER', label: 'Buyers Only' },
  { value: 'SELLER', label: 'Sellers Only' },
  { value: 'AGENT_ONLY', label: 'Agents Only' },
] as const;

const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

export function KbArticleEditor({ categories, initialData }: KbArticleEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(initialData?.status ?? 'DRAFT');

  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? '');
  const [body, setBody] = useState(initialData?.body ?? '');
  const [audience, setAudience] = useState(initialData?.audience ?? 'ALL');
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
  const [isPinned, setIsPinned] = useState(initialData?.isPinned ?? false);
  const [searchKeywords, setSearchKeywords] = useState(
    (initialData?.searchKeywords ?? []).join(', ')
  );
  const [tags, setTags] = useState((initialData?.tags ?? []).join(', '));
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription ?? '');

  const isEditing = Boolean(initialData?.id);
  const articleId = initialData?.id;

  function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!initialData?.slug) setSlug(slugify(value));
  }

  function parseKeywords(raw: string): string[] {
    return raw.split(',').map((k) => k.trim()).filter(Boolean);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (isEditing && articleId) {
        const result = await updateKbArticle({
          articleId,
          categoryId: categoryId || undefined,
          slug,
          title: title.trim(),
          excerpt: excerpt.trim() || null,
          body: body.trim(),
          bodyFormat: 'MARKDOWN',
          audience: audience as 'ALL' | 'BUYER' | 'SELLER' | 'AGENT_ONLY',
          isFeatured,
          isPinned,
          searchKeywords: parseKeywords(searchKeywords),
          tags: parseKeywords(tags),
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
        });
        if (result.success) { router.push('/kb'); } else { setError(result.error ?? 'Failed to save article.'); }
      } else {
        const result = await createKbArticle({
          categoryId,
          slug,
          title: title.trim(),
          excerpt: excerpt.trim() || undefined,
          body: body.trim(),
          bodyFormat: 'MARKDOWN',
          audience: audience as 'ALL' | 'BUYER' | 'SELLER' | 'AGENT_ONLY',
          isFeatured,
          isPinned,
          searchKeywords: parseKeywords(searchKeywords),
          tags: parseKeywords(tags),
          metaTitle: metaTitle.trim() || undefined,
          metaDescription: metaDescription.trim() || undefined,
        });
        if (result.success) { router.push('/kb'); } else { setError(result.error ?? 'Failed to save article.'); }
      }
    });
  }

  const categorySlugForPreview = initialData?.categoryId
    ? categories.find((c) => c.id === initialData.categoryId)?.slug
    : undefined;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} required disabled={isPending} className={inputCls} placeholder="Article title" />
        </div>
        <div>
          <label className={labelCls}>Slug</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required disabled={isPending} pattern="[a-z0-9-]+" className={`${inputCls} font-mono`} placeholder="article-slug" />
        </div>
        <div>
          <label className={labelCls}>Excerpt</label>
          <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} disabled={isPending} maxLength={300} className={inputCls} placeholder="Brief summary (optional)" />
        </div>
        <div>
          <label className={labelCls}>Body (Markdown)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={16} disabled={isPending} className={`${inputCls} font-mono resize-y`} placeholder="Write your article content in Markdown…" />
        </div>
        <div>
          <label className={labelCls}>Search Keywords</label>
          <input type="text" value={searchKeywords} onChange={(e) => setSearchKeywords(e.target.value)} disabled={isPending} className={inputCls} placeholder="Comma-separated keywords (e.g. refund, return, shipping)" />
        </div>
        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        <div className="space-y-3">
          <div className="flex justify-end gap-3">
            <button type="submit" disabled={isPending} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
          {isEditing && articleId && (
            <KbArticleToolbar
              articleId={articleId}
              status={currentStatus}
              categorySlug={categorySlugForPreview}
              articleSlug={slug}
              isPendingSave={isPending}
              onError={(msg) => setError(msg)}
              onSuccess={() => setCurrentStatus(
                currentStatus === 'PUBLISHED' ? 'ARCHIVED'
                : currentStatus === 'DRAFT' ? 'REVIEW'
                : 'PUBLISHED'
              )}
            />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isPending} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} disabled={isPending} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
            {AUDIENCE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tags</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} disabled={isPending} className={inputCls} placeholder="Comma-separated tags" />
        </div>
        <div>
          <label className={labelCls}>Meta Title</label>
          <input type="text" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} disabled={isPending} maxLength={70} className={inputCls} placeholder="SEO title (max 70 chars)" />
        </div>
        <div>
          <label className={labelCls}>Meta Description</label>
          <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} disabled={isPending} rows={2} maxLength={160} className={`${inputCls} resize-none`} placeholder="SEO description (max 160 chars)" />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} disabled={isPending} className="rounded" />
            Featured article
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} disabled={isPending} className="rounded" />
            Pinned
          </label>
        </div>
      </div>
    </form>
  );
}
