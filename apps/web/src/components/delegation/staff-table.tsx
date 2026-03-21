'use client';

import { useState, useTransition } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@twicely/ui/table';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@twicely/ui/alert-dialog';
import { EditScopesDialog } from './edit-scopes-dialog';
import { revokeStaffMember } from '@/lib/actions/delegation';
import { SCOPE_LABELS } from '@/lib/delegation/constants';
import type { StaffMember } from '@/lib/queries/delegation';

type StaffTableProps = {
  members: StaffMember[];
};

function StatusBadge({ status }: { status: StaffMember['status'] }) {
  const variants: Record<StaffMember['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    ACTIVE: 'default',
    PENDING: 'secondary',
    REVOKED: 'destructive',
    EXPIRED: 'outline',
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

function ScopeBadges({ scopes }: { scopes: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 max-w-xs">
      {scopes.slice(0, 4).map((scope) => (
        <Badge key={scope} variant="outline" className="text-xs">
          {SCOPE_LABELS[scope as keyof typeof SCOPE_LABELS] ?? scope}
        </Badge>
      ))}
      {scopes.length > 4 && (
        <Badge variant="outline" className="text-xs">+{scopes.length - 4} more</Badge>
      )}
    </div>
  );
}

function StaffMemberRow({
  member,
  onRevoked,
}: {
  member: StaffMember;
  onRevoked: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isActionable = member.status === 'ACTIVE' || member.status === 'PENDING';

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeStaffMember({ delegationId: member.id });
      if (result.success) {
        setRevokeOpen(false);
        onRevoked();
      } else {
        setRevokeError(result.error ?? 'An error occurred');
      }
    });
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <div>
            <p className="font-medium">{member.name}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
        </TableCell>
        <TableCell>
          <ScopeBadges scopes={member.scopes} />
        </TableCell>
        <TableCell><StatusBadge status={member.status} /></TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {member.invitedAt.toLocaleDateString()}
        </TableCell>
        <TableCell>—</TableCell>
        <TableCell>
          {isActionable && (
            <div className="flex gap-2">
              {member.status === 'ACTIVE' && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRevokeOpen(true)}
                disabled={isPending}
              >
                Revoke
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      {member.status === 'ACTIVE' && (
        <EditScopesDialog
          delegationId={member.id}
          currentScopes={member.scopes}
          staffEmail={member.email}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={onRevoked}
        />
      )}

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {member.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove their staff access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && <p className="text-sm text-destructive px-6">{revokeError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={isPending}>
              {isPending ? 'Revoking...' : 'Revoke access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function StaffTable({ members }: StaffTableProps) {
  const [, forceUpdate] = useState(0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff member</TableHead>
          <TableHead>Permissions</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invited</TableHead>
          <TableHead>Last activity</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <StaffMemberRow
            key={member.id}
            member={member}
            onRevoked={() => forceUpdate((n) => n + 1)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
