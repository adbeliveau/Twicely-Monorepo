'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { CategoryForm } from '@/components/admin/category-form';
import { deleteCategory } from '@/lib/actions/admin-categories';
import { useRouter } from 'next/navigation';
import type { AdminCategoryDetail } from '@/lib/queries/admin-categories';

interface Props {
  cat: AdminCategoryDetail;
  categories: Array<{ id: string; name: string; depth: number }>;
}

export function CategoryDetailEdit({ cat, categories }: Props): React.ReactElement {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  async function handleDeactivate() {
    if (!confirm(`Deactivate "${cat.name}"? This will hide it from all public views.`)) return;
    setDeactivating(true);
    setDeactivateError(null);
    const result = await deleteCategory(cat.id);
    setDeactivating(false);
    if (!result.success) {
      setDeactivateError(result.error ?? 'Deactivation failed');
    } else {
      router.push('/categories');
    }
  }

  return (
    <div className="space-y-4">
      {deactivateError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deactivateError}</div>
      )}

      {!showEdit ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowEdit(true)}>Edit Category</Button>
          {cat.isActive && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </Button>
          )}
        </div>
      ) : (
        <CategoryForm
          mode="edit"
          initialData={{
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            parentId: cat.parentId,
            description: cat.description,
            icon: cat.icon,
            feeBucket: cat.feeBucket,
            sortOrder: cat.sortOrder,
            isActive: cat.isActive,
            isLeaf: cat.isLeaf,
            metaTitle: cat.metaTitle,
            metaDescription: cat.metaDescription,
          }}
          categories={categories}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
