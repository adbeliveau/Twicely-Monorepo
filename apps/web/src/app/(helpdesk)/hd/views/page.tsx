import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { BookmarkPlus } from 'lucide-react';

export const metadata: Metadata = { title: 'Saved Views | Twicely Hub' };

export default async function HelpdeskViewsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'HelpdeskCase')) {
    return <p className="p-6 text-sm text-red-600">Access denied</p>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Saved Views</h1>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <BookmarkPlus className="h-4 w-4" />
          New View
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <BookmarkPlus className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm font-medium text-gray-600">No saved views yet</p>
        <p className="mt-1 text-sm text-gray-400">
          Create a view to save your filter presets for quick access.
        </p>
      </div>
    </div>
  );
}
