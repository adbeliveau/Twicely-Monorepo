'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import type { AdminCategoryNode } from '@/lib/queries/admin-categories';

interface CategoryTreeViewProps {
  nodes: AdminCategoryNode[];
  canManage: boolean;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

interface CategoryNodeRowProps {
  node: AdminCategoryNode;
  depth: number;
  siblings: AdminCategoryNode[];
  siblingIndex: number;
  canManage: boolean;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

function CategoryNodeRow({
  node,
  depth,
  siblings,
  siblingIndex,
  canManage,
  onReorder,
}: CategoryNodeRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(depth === 0);
  const [isPending, startTransition] = useTransition();

  const hasChildren = node.children.length > 0;
  const isFirst = siblingIndex === 0;
  const isLast = siblingIndex === siblings.length - 1;

  function handleMove(direction: 'up' | 'down') {
    const newOrder = [...siblings];
    const targetIndex = direction === 'up' ? siblingIndex - 1 : siblingIndex + 1;
    const temp = newOrder[siblingIndex];
    newOrder[siblingIndex] = newOrder[targetIndex]!;
    newOrder[targetIndex] = temp!;
    startTransition(() => {
      void onReorder(newOrder.map((n) => n.id));
    });
  }

  return (
    <li className="list-none">
      <div
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50',
          node.isActive ? '' : 'opacity-50',
        ].join(' ')}
        style={{ paddingLeft: `${(depth + 1) * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <Link
          href={`/categories/${node.id}`}
          className="font-medium text-sm text-blue-600 hover:underline flex-1 truncate"
        >
          {node.name}
        </Link>

        <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-[120px]">
          {node.slug}
        </span>

        <Badge variant="outline" className="text-xs flex-shrink-0">
          {node.feeBucket}
        </Badge>

        <span className="text-xs text-gray-500 flex-shrink-0">
          {node.listingCount} listings
        </span>

        {node.isActive ? (
          <Badge variant="default" className="text-xs flex-shrink-0 bg-green-100 text-green-700">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs flex-shrink-0 text-gray-400">
            Inactive
          </Badge>
        )}

        {canManage && (
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMove('up')}
              disabled={isFirst || isPending}
              aria-label="Move up"
              className="h-6 w-6 p-0"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMove('down')}
              disabled={isLast || isPending}
              aria-label="Move down"
              className="h-6 w-6 p-0"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <ul className="ml-0">
          {node.children.map((child, idx) => (
            <CategoryNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              siblings={node.children}
              siblingIndex={idx}
              canManage={canManage}
              onReorder={onReorder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CategoryTreeView({
  nodes,
  canManage,
  onReorder,
}: CategoryTreeViewProps): React.ReactElement {
  function handleRootReorder(orderedIds: string[]) {
    return onReorder(orderedIds);
  }

  return (
    <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
      {nodes.map((node, idx) => (
        <CategoryNodeRow
          key={node.id}
          node={node}
          depth={0}
          siblings={nodes}
          siblingIndex={idx}
          canManage={canManage}
          onReorder={handleRootReorder}
        />
      ))}
      {nodes.length === 0 && (
        <li className="px-4 py-6 text-center text-sm text-gray-400">
          No categories found.
        </li>
      )}
    </ul>
  );
}
