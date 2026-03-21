'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Button } from '@twicely/ui/button';
import { ScopeSelector } from './scope-selector';
import { inviteStaffMember } from '@/lib/actions/delegation';

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError('Email address is required');
      return;
    }
    if (scopes.length === 0) {
      setError('At least one permission must be selected');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await inviteStaffMember({ email, scopes });
      if (result.success) {
        router.push('/my/selling/staff');
      } else {
        setError(result.error ?? 'An error occurred');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="staff-email">Email address</Label>
        <Input
          id="staff-email"
          type="email"
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          required
        />
        <p className="text-xs text-muted-foreground">
          The person must have an existing Twicely account.
        </p>
      </div>

      <div className="space-y-1">
        <Label>Permissions</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select a role preset or choose individual permissions.
        </p>
        <ScopeSelector selectedScopes={scopes} onChange={setScopes} disabled={isPending} />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending || scopes.length === 0}>
          {isPending ? 'Sending...' : 'Send invitation'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/my/selling/staff')}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
