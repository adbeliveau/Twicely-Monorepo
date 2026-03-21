// NAV_ENTRY: { key: 'categories', label: 'Categories', href: '/categories', icon: 'FolderOpen', roles: ['ADMIN', 'MODERATION'] }
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminCategoryTree } from '@/lib/queries/admin-categories';
import { db } from '@twicely/db';
import { category } from '@twicely/db/schema';
import { count, eq, isNull } from 'drizzle-orm';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CategoryTreeClient } from './category-tree-client';
import { Button } from '@twicely/ui/button';

export const metadata: Metadata = {
  title: 'Categories | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function CategoriesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Category')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canManage = ability.can('manage', 'Category');

  const [totalResult, rootResult, activeResult, inactiveResult, tree] = await Promise.all([
    db.select({ count: count() }).from(category),
    db.select({ count: count() }).from(category).where(isNull(category.parentId)),
    db.select({ count: count() }).from(category).where(eq(category.isActive, true)),
    db.select({ count: count() }).from(category).where(eq(category.isActive, false)),
    getAdminCategoryTree(),
  ]);

  const totalCount = totalResult[0]?.count ?? 0;
  const rootCount = rootResult[0]?.count ?? 0;
  const activeCount = activeResult[0]?.count ?? 0;
  const inactiveCount = inactiveResult[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Categories"
        description="Manage the category tree, attribute schemas, and display order."
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Link href="/categories/catalog">
                <Button variant="outline" size="sm">Catalog Browser</Button>
              </Link>
              <Link href="/categories/new">
                <Button size="sm">Add Root Category</Button>
              </Link>
            </div>
          ) : (
            <Link href="/categories/catalog">
              <Button variant="outline" size="sm">Catalog Browser</Button>
            </Link>
          )
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Root</p>
          <p className="text-2xl font-bold">{rootCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold">{inactiveCount}</p>
        </div>
      </div>

      <CategoryTreeClient nodes={tree} canManage={canManage} />
    </div>
  );
}
