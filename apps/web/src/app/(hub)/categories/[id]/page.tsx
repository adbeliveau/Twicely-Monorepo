// NAV_ENTRY: child of /categories -- no separate nav entry needed
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminCategoryById, getAdminCategoryTree } from '@/lib/queries/admin-categories';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AttributeSchemaTable } from '@/components/admin/attribute-schema-table';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { CategoryDetailEdit } from './category-detail-edit';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Category Detail | Twicely Hub',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoryDetailPage({ params }: Props) {
  const { id } = await params;
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Category')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canManage = ability.can('manage', 'Category');

  const [cat, allCategories] = await Promise.all([
    getAdminCategoryById(id),
    canManage ? getAdminCategoryTree() : Promise.resolve([]),
  ]);

  if (!cat) notFound();

  function flattenCategories(
    nodes: Awaited<ReturnType<typeof getAdminCategoryTree>>,
    depth = 0
  ): Array<{ id: string; name: string; depth: number }> {
    const result: Array<{ id: string; name: string; depth: number }> = [];
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, depth });
      result.push(...flattenCategories(node.children, depth + 1));
    }
    return result;
  }

  const flatCategories = flattenCategories(allCategories);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Categories
        {cat.parentName && (
          <span className="text-gray-400"> / {cat.parentName}</span>
        )}
      </Link>

      <AdminPageHeader
        title={cat.name}
        description={`/${cat.path}`}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Link href={`/categories/new?parentId=${cat.id}`}>
                <Button variant="outline" size="sm">Add Subcategory</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        {cat.isActive ? (
          <Badge className="bg-green-100 text-green-700">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-gray-400">Inactive</Badge>
        )}
        {cat.isLeaf && <Badge variant="outline" className="text-xs">Leaf</Badge>}
      </div>

      {/* Detail card */}
      <div className="rounded-lg border p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><span className="text-gray-500 mr-2">Slug:</span><code className="text-xs bg-gray-100 px-1 rounded">{cat.slug}</code></div>
        <div><span className="text-gray-500 mr-2">Fee Bucket:</span>{cat.feeBucket} <span className="text-xs text-gray-400">(legacy)</span></div>
        <div><span className="text-gray-500 mr-2">Depth:</span>{cat.depth}</div>
        <div><span className="text-gray-500 mr-2">Sort Order:</span>{cat.sortOrder}</div>
        <div><span className="text-gray-500 mr-2">Path:</span><code className="text-xs bg-gray-100 px-1 rounded">{cat.path}</code></div>
        <div><span className="text-gray-500 mr-2">Listings:</span><span className="font-semibold">{cat.listingCount}</span></div>
        {cat.description && (
          <div className="col-span-2"><span className="text-gray-500 mr-2">Description:</span>{cat.description}</div>
        )}
        {cat.metaTitle && (
          <div className="col-span-2"><span className="text-gray-500 mr-2">Meta Title:</span>{cat.metaTitle}</div>
        )}
        {cat.metaDescription && (
          <div className="col-span-2"><span className="text-gray-500 mr-2">Meta Description:</span>{cat.metaDescription}</div>
        )}
        <div><span className="text-gray-500 mr-2">Created:</span>{cat.createdAt.toLocaleDateString()}</div>
        <div><span className="text-gray-500 mr-2">Updated:</span>{cat.updatedAt.toLocaleDateString()}</div>
      </div>

      {/* Subcategories */}
      {(cat.children.length > 0 || !cat.isLeaf) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Subcategories ({cat.children.length})</h2>
          {cat.children.length === 0 ? (
            <p className="text-sm text-gray-400">No subcategories.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Slug</th>
                    <th className="px-3 py-2 font-medium">Listings</th>
                    <th className="px-3 py-2 font-medium">Sort</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.children.map((child) => (
                    <tr key={child.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link href={`/categories/${child.id}`} className="text-blue-600 hover:underline font-medium">
                          {child.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500">{child.slug}</td>
                      <td className="px-3 py-2">{child.listingCount}</td>
                      <td className="px-3 py-2">{child.sortOrder}</td>
                      <td className="px-3 py-2">
                        {child.isActive ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Attribute Schemas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Attribute Schemas ({cat.attributeSchemas.length})</h2>
        <AttributeSchemaTable
          categoryId={cat.id}
          schemas={cat.attributeSchemas}
          canManage={canManage}
        />
      </section>

      {/* Edit form (ADMIN only) */}
      {canManage && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-sm font-semibold text-gray-700">Edit Category</h2>
          <CategoryDetailEdit cat={cat} categories={flatCategories} />
        </section>
      )}
    </div>
  );
}
