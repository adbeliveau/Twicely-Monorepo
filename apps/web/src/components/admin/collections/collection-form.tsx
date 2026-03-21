'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCollectionAction,
  updateCollectionAction,
} from '@/lib/actions/admin-curated-collections';
import type { AdminCollectionDetail } from '@/lib/queries/admin-curated-collections';

interface CollectionFormProps {
  collection?: AdminCollectionDetail;
  mode: 'create' | 'edit';
}

function toInputDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 16);
}

export function CollectionForm({ collection, mode }: CollectionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [title, setTitle] = useState(collection?.title ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(collection?.coverImageUrl ?? '');
  const [sortOrder, setSortOrder] = useState(collection?.sortOrder ?? 0);
  const [startDate, setStartDate] = useState(toInputDate(collection?.startDate));
  const [endDate, setEndDate] = useState(toInputDate(collection?.endDate));
  const [isPublished, setIsPublished] = useState(collection?.isPublished ?? false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }

    startTransition(async () => {
      if (mode === 'create') {
        const input: Record<string, unknown> = { title, sortOrder };
        if (description) input.description = description;
        if (coverImageUrl) input.coverImageUrl = coverImageUrl;
        if (startDate) input.startDate = new Date(startDate).toISOString();
        if (endDate) input.endDate = new Date(endDate).toISOString();

        const result = await createCollectionAction(input);
        if ('error' in result) {
          setErrorMsg(result.error ?? 'An error occurred');
        } else {
          router.push(`/mod/collections/${result.collectionId}`);
        }
      } else {
        if (!collection) return;
        const input: Record<string, unknown> = {
          collectionId: collection.id,
          title,
          description: description || null,
          coverImageUrl: coverImageUrl || null,
          sortOrder,
          isPublished,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
        };

        const result = await updateCollectionAction(input);
        if ('error' in result) {
          setErrorMsg(result.error ?? 'An error occurred');
        } else {
          setSuccessMsg('Collection updated');
          router.refresh();
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700">
          Cover Image URL
        </label>
        <input
          id="coverImageUrl"
          type="url"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700">
          Sort Order
        </label>
        <input
          id="sortOrder"
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
            Start Date (seasonal)
          </label>
          <input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
            End Date (seasonal)
          </label>
          <input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {mode === 'edit' && (
        <div className="flex items-center gap-2">
          <input
            id="isPublished"
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">
            Published
          </label>
        </div>
      )}

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode === 'create' ? 'Create Collection' : 'Save Changes'}
      </button>
    </form>
  );
}
