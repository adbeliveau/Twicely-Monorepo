'use client';

/**
 * Feature Flag Table (E4 + G10.4 + I16)
 * Displays regular feature flags (non kill.*, non gate.*).
 * Kill switches and launch gates are rendered in their own panels.
 * I16: adds row links to /flags/{id} detail page.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Switch } from '@twicely/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@twicely/ui/dialog';
import { Trash2, Plus } from 'lucide-react';
import { toggleFeatureFlagAction, deleteFeatureFlagAction } from '@/lib/actions/admin-feature-flags';
import { FeatureFlagForm } from './feature-flag-form';
import type { FeatureFlagRow } from '@/lib/queries/admin-feature-flags';

const TYPE_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  BOOLEAN: 'default',
  PERCENTAGE: 'secondary',
  TARGETED: 'outline',
};

interface FeatureFlagTableProps {
  flags: FeatureFlagRow[];
  canCreate: boolean;
  canDelete: boolean;
}

export function FeatureFlagTable({ flags, canCreate, canDelete }: FeatureFlagTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlagRow | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleToggle(flagId: string) {
    startTransition(async () => {
      await toggleFeatureFlagAction({ flagId });
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteFeatureFlagAction({ flagId: deletingId });
    setDeleteLoading(false);
    if (!('error' in result)) {
      setDeletingId(null);
      router.refresh();
    }
  }

  function openCreate() {
    setEditingFlag(undefined);
    setFormOpen(true);
  }

  function openEdit(flag: FeatureFlagRow) {
    setEditingFlag(flag);
    setFormOpen(true);
  }

  function handleFormSuccess() {
    setFormOpen(false);
    setEditingFlag(undefined);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Create Flag
          </Button>
        </div>
      )}

      {flags.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No feature flags configured yet.
        </p>
      ) : (
        <div className={`rounded-md border overflow-x-auto ${isPending ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <th className="py-2 px-4 text-left">Key</th>
                <th className="py-2 px-4 text-left">Name</th>
                <th className="py-2 px-4 text-left">Type</th>
                <th className="py-2 px-4 text-center">Enabled</th>
                <th className="py-2 px-4 text-left">Value</th>
                <th className="py-2 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr
                  key={flag.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 font-mono text-xs">
                    <Link href={`/flags/${flag.id}`} className="hover:underline hover:text-blue-600">
                      {flag.key}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/flags/${flag.id}`} className="hover:underline hover:text-blue-600">
                      {flag.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={TYPE_COLORS[flag.type] ?? 'default'}>
                      {flag.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => handleToggle(flag.id)}
                      disabled={isPending}
                    />
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {flag.type === 'PERCENTAGE' && flag.percentage !== null
                      ? `${flag.percentage}%`
                      : flag.type === 'TARGETED'
                        ? 'Targeted'
                        : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(flag)}
                      >
                        Edit
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeletingId(flag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) setFormOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFlag ? 'Edit Flag' : 'Create Flag'}</DialogTitle>
          </DialogHeader>
          <FeatureFlagForm
            initialData={editingFlag}
            onSuccess={handleFormSuccess}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Flag</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this feature flag. Any code checking this flag will receive
            <code className="mx-1 text-xs bg-gray-100 px-1 rounded">false</code>.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteLoading}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
