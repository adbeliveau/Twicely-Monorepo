'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Checkbox } from '@twicely/ui/checkbox';
import { Input } from '@twicely/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@twicely/ui/table';
import type { BulkUserRow, BulkUserSummary } from '@/lib/queries/admin-data-bulk';
import { bulkBanUsersAction, bulkUnbanUsersAction } from '@/lib/actions/admin-data-management';

interface BulkUserPanelProps {
  initialUsers: BulkUserRow[];
  initialTotal: number;
  summary: BulkUserSummary;
}

export function BulkUserPanel({
  initialUsers,
  initialTotal,
  summary,
}: BulkUserPanelProps) {
  const [users] = useState<BulkUserRow[]>(initialUsers);
  const [total] = useState<number>(initialTotal);
  const [search, setSearch] = useState('');
  const [bannedFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [banReason, setBanReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  void summary;
  void bannedFilter;
  void search;

  const allIds = users.map((u) => u.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function handleBanClick() {
    if (selectedIds.size === 0) return;
    setShowReasonInput(true);
  }

  function handleBanConfirm() {
    if (!banReason.trim()) {
      setMessage({ type: 'error', text: 'A ban reason is required.' });
      return;
    }
    startTransition(async () => {
      const result = await bulkBanUsersAction({
        userIds: Array.from(selectedIds),
        reason: banReason.trim(),
      });
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: `${selectedIds.size} user(s) banned.` });
        setSelectedIds(new Set());
        setBanReason('');
        setShowReasonInput(false);
      }
    });
  }

  function handleUnban() {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await bulkUnbanUsersAction({ userIds: Array.from(selectedIds) });
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: `${selectedIds.size} user(s) unbanned.` });
        setSelectedIds(new Set());
      }
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Users</h2>
      <p className="text-sm text-gray-500">{total} total users</p>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">{selectedIds.size} selected</span>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={handleBanClick}
            >
              Ban Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleUnban}
            >
              Unban Selected
            </Button>
          </div>
          {showReasonInput && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter ban reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-80"
              />
              <Button size="sm" variant="destructive" disabled={isPending} onClick={handleBanConfirm}>
                Confirm Ban
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowReasonInput(false); setBanReason(''); }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={[
            'rounded-md px-4 py-3 text-sm',
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200',
          ].join(' ')}
          role="alert"
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Banned</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => toggleOne(u.id)}
                      aria-label={`Select user ${u.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{u.name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.isSeller ? 'default' : 'outline'}>
                      {u.isSeller ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isBanned ? 'destructive' : 'secondary'}>
                      {u.isBanned ? 'Banned' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
