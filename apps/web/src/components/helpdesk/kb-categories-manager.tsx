'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteKbCategory } from '@/lib/actions/kb-categories';
import { KbCategoryForm } from './kb-category-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  articleCount: number;
}

interface KbCategoriesManagerProps {
  categories: CategoryRow[];
}

export function KbCategoriesManager({ categories }: KbCategoriesManagerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleNew() {
    setEditTarget(null);
    setShowForm(true);
  }

  function handleEdit(cat: CategoryRow) {
    setEditTarget(cat);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditTarget(null);
  }

  function handleFormComplete() {
    setShowForm(false);
    setEditTarget(null);
    router.refresh();
  }

  function handleDeleteClick(cat: CategoryRow) {
    setDeleteTarget(cat);
    setDeleteError(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteKbCategory(deleteTarget.id);
    setIsDeleting(false);

    if (result.success) {
      setDeleteTarget(null);
      router.refresh();
    } else {
      setDeleteError(result.error ?? 'Failed to delete category.');
    }
  }

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={handleNew}
          className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          New Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm font-medium text-gray-600">No categories yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {cat.icon && (
                  <span className="text-sm text-gray-400">{cat.icon}</span>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                  <p className="text-xs text-gray-400">
                    /{cat.slug}
                    {cat.articleCount > 0 && (
                      <span className="ml-2">{cat.articleCount} article{cat.articleCount !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {cat.isActive ? 'Active' : 'Hidden'}
                </span>
                <span className="text-xs text-gray-400">#{cat.sortOrder}</span>
                <button
                  type="button"
                  onClick={() => handleEdit(cat)}
                  className="rounded p-1 text-gray-400 hover:text-brand-500"
                  aria-label={`Edit ${cat.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(cat)}
                  className="rounded p-1 text-gray-400 hover:text-red-600"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      {showForm && (
        <KbCategoryForm
          category={editTarget ?? undefined}
          allCategories={categoryOptions}
          onComplete={handleFormComplete}
          onClose={handleFormClose}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Delete category?</h2>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This cannot be undone.
            </p>
            {deleteError && (
              <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                disabled={isDeleting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
