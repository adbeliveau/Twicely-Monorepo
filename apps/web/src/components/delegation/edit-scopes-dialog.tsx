'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { ScopeSelector } from './scope-selector';
import { updateStaffScopes } from '@/lib/actions/delegation';

type EditScopesDialogProps = {
  delegationId: string;
  currentScopes: string[];
  staffEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function EditScopesDialog({
  delegationId,
  currentScopes,
  staffEmail,
  open,
  onOpenChange,
  onSuccess,
}: EditScopesDialogProps) {
  const [scopes, setScopes] = useState<string[]>(currentScopes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (scopes.length === 0) {
      setError('At least one scope must be selected');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await updateStaffScopes({ delegationId, scopes });
      if (result.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(result.error ?? 'An error occurred');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit permissions for {staffEmail}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <ScopeSelector
            selectedScopes={scopes}
            onChange={setScopes}
            disabled={isPending}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || scopes.length === 0}>
            {isPending ? 'Saving...' : 'Save permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
