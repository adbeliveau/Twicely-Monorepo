// NAV_ENTRY: child of /categories -- no separate nav entry needed
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminCategoryTree } from '@/lib/queries/admin-categories';
import { CategoryForm } from '@/components/admin/category-form';
import { ArrowLeft } from 'lucide-react';
import type { AdminCategoryNode } from '@/lib/queries/admin-categories';

export const metadata: Metadata = {
  title: 'New Category | Twicely Hub',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ parentId?: string }>;
}

function flattenCategories(
  nodes: AdminCategoryNode[],
  depth = 0
): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, depth });
    result.push(...flattenCategories(node.children, depth + 1));
  }
  return result;
}

export default async function NewCategoryPage({ searchParams }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'Category')) {
    return <p className="p-6 text-sm text-red-600">Access denied. ADMIN role required.</p>;
  }

  const params = await searchParams;
  const parentId = params.parentId ?? null;

  const tree = await getAdminCategoryTree();
  const categories = flattenCategories(tree);

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Categories
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-primary">New Category</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Create a new {parentId ? 'subcategory' : 'root category'}.
        </p>
      </div>

      <CategoryForm
        mode="create"
        initialData={{ parentId: parentId ?? null }}
        categories={categories}
      />
    </div>
  );
}
