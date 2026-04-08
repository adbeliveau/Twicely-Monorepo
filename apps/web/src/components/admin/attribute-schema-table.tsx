'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import type { AdminCategoryDetail } from '@/lib/queries/admin-categories';
import { deleteAttributeSchema } from '@/lib/actions/admin-categories-attrs';
import { AttributeSchemaForm } from './attribute-schema-form';

type SchemaRow = AdminCategoryDetail['attributeSchemas'][number];

interface AttributeSchemaTableProps {
  categoryId: string;
  schemas: AdminCategoryDetail['attributeSchemas'];
  canManage: boolean;
}

function BoolBadge({ val }: { val: boolean }): React.ReactElement {
  return val ? (
    <Badge variant="default" className="bg-green-100 text-green-700 text-xs">Yes</Badge>
  ) : (
    <Badge variant="outline" className="text-gray-400 text-xs">No</Badge>
  );
}

export function AttributeSchemaTable({
  categoryId,
  schemas,
  canManage,
}: AttributeSchemaTableProps): React.ReactElement {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<SchemaRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this attribute schema?')) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteAttributeSchema(id);
      if (!result.success) setDeleteError(result.error ?? 'Delete failed');
    });
  }

  if (showAdd) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Add Attribute Schema</h3>
        <AttributeSchemaForm
          mode="create"
          categoryId={categoryId}
          onDone={() => setShowAdd(false)}
        />
      </div>
    );
  }

  if (editTarget) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Edit Attribute Schema</h3>
        <AttributeSchemaForm
          mode="edit"
          categoryId={categoryId}
          initialData={editTarget}
          onDone={() => setEditTarget(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deleteError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</div>
      )}

      {schemas.length === 0 ? (
        <p className="text-sm text-gray-400">No attribute schemas defined for this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium">Label</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Required</th>
                <th className="pb-2 pr-3 font-medium">Recommended</th>
                <th className="pb-2 pr-3 font-medium">In Filters</th>
                <th className="pb-2 pr-3 font-medium">In Listing</th>
                <th className="pb-2 font-medium">Sort</th>
                {canManage && <th className="pb-2" />}
              </tr>
            </thead>
            <tbody>
              {schemas.map((schema) => (
                <tr key={schema.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-mono">{schema.name}</td>
                  <td className="py-2 pr-3">{schema.label}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className="text-xs">{schema.fieldType}</Badge>
                  </td>
                  <td className="py-2 pr-3"><BoolBadge val={schema.isRequired} /></td>
                  <td className="py-2 pr-3"><BoolBadge val={schema.isRecommended} /></td>
                  <td className="py-2 pr-3"><BoolBadge val={schema.showInFilters} /></td>
                  <td className="py-2 pr-3"><BoolBadge val={schema.showInListing} /></td>
                  <td className="py-2 pr-3">{schema.sortOrder}</td>
                  {canManage && (
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTarget(schema)}
                          className="h-6 w-6 p-0"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(schema.id)}
                          disabled={isPending}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Attribute Schema
        </Button>
      )}
    </div>
  );
}
