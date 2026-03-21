'use client';

/**
 * Anonymization Queue Component (I13)
 * Displays users pending deletion with optional manage actions.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import {
  forceAnonymizeUserAction,
  cancelDeletionRequestAction,
} from '@/lib/actions/admin-anonymization-queue';
import type { AnonymizationRow } from '@/lib/queries/admin-anonymization-queue';

const GRACE_PERIOD_MS = 30 * 86400000;

interface AnonymizationQueueProps {
  initialQueue: AnonymizationRow[];
  initialTotal: number;
  canManage: boolean;
}

export function AnonymizationQueue({
  initialQueue,
  canManage,
}: AnonymizationQueueProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  function getScheduledDeletion(deletionRequestedAt: Date): Date {
    return new Date(deletionRequestedAt.getTime() + GRACE_PERIOD_MS);
  }

  function formatDate(d: Date | null): string {
    if (!d) return '--';
    return new Date(d).toLocaleString();
  }

  const filtered = initialQueue.filter((r) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && r.anonymizedAt === null) ||
      (filter === 'processed' && r.anonymizedAt !== null);
    const matchesSearch =
      !search ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function handleForceAnonymize(userId: string) {
    startTransition(async () => {
      await forceAnonymizeUserAction(userId);
      router.refresh();
    });
  }

  function handleCancelDeletion(userId: string) {
    startTransition(async () => {
      await cancelDeletionRequestAction(userId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No users in the anonymization queue.
        </p>
      ) : (
        <div className={`rounded-md border overflow-x-auto ${isPending ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <th className="py-2 px-4 text-left">User ID</th>
                <th className="py-2 px-4 text-left">Email</th>
                <th className="py-2 px-4 text-left">Name</th>
                <th className="py-2 px-4 text-left">Deletion Requested</th>
                <th className="py-2 px-4 text-left">Scheduled Deletion</th>
                <th className="py-2 px-4 text-left">Anonymized</th>
                {canManage && (
                  <th className="py-2 px-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.userId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                    {row.userId.slice(0, 8)}…
                  </td>
                  <td className="py-3 px-4 text-xs">{row.email ?? '—'}</td>
                  <td className="py-3 px-4 text-xs">{row.name ?? '—'}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formatDate(row.deletionRequestedAt)}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formatDate(getScheduledDeletion(row.deletionRequestedAt))}
                  </td>
                  <td className="py-3 px-4">
                    {row.anonymizedAt ? (
                      <Badge variant="outline" className="text-xs">
                        {formatDate(row.anonymizedAt)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleForceAnonymize(row.userId)}
                          disabled={isPending || row.anonymizedAt !== null}
                        >
                          Force Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelDeletion(row.userId)}
                          disabled={isPending || row.anonymizedAt !== null}
                        >
                          Cancel
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
    </div>
  );
}
