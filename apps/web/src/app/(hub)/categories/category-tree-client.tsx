'use client';

import { CategoryTreeView } from '@/components/admin/category-tree-view';
import { reorderCategories } from '@/lib/actions/admin-categories';
import type { AdminCategoryNode } from '@/lib/queries/admin-categories';
import { useState } from 'react';

interface CategoryTreeClientProps {
  nodes: AdminCategoryNode[];
  canManage: boolean;
}

type Filter = 'all' | 'active' | 'inactive';

function filterTree(nodes: AdminCategoryNode[], filter: Filter): AdminCategoryNode[] {
  if (filter === 'all') return nodes;
  return nodes
    .filter((n) => filter === 'active' ? n.isActive : !n.isActive)
    .map((n) => ({
      ...n,
      children: filterTree(n.children, filter),
    }));
}

export function CategoryTreeClient({
  nodes,
  canManage,
}: CategoryTreeClientProps): React.ReactElement {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filterTree(nodes, filter);

  async function handleReorder(orderedIds: string[]): Promise<void> {
    await reorderCategories({ orderedIds });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              'px-3 py-1 rounded-md text-sm border',
              filter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50',
            ].join(' ')}
          >
            {f === 'all' ? 'Show All' : f === 'active' ? 'Active Only' : 'Inactive Only'}
          </button>
        ))}
      </div>

      <CategoryTreeView
        nodes={filtered}
        canManage={canManage}
        onReorder={handleReorder}
      />
    </div>
  );
}
