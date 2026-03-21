'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { suspendAffiliate, unsuspendAffiliate, banAffiliate } from '@/lib/actions/affiliate-admin';

interface AffiliateAdminActionsProps {
  affiliateId: string;
  status: string;
}

export function AffiliateAdminActions({ affiliateId, status }: AffiliateAdminActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'ban' | null>(null);

  function handleSuspend() {
    setError(null);
    startTransition(async () => {
      const result = await suspendAffiliate({ affiliateId, reason: suspendReason.trim() });
      if (result.success) {
        setSuccess('Affiliate suspended successfully.');
        setConfirmAction(null);
      } else {
        setError(result.error ?? 'Suspend failed');
      }
    });
  }

  function handleUnsuspend() {
    setError(null);
    startTransition(async () => {
      const result = await unsuspendAffiliate({ affiliateId });
      if (result.success) {
        setSuccess('Affiliate unsuspended successfully.');
      } else {
        setError(result.error ?? 'Unsuspend failed');
      }
    });
  }

  function handleBan() {
    setError(null);
    startTransition(async () => {
      const result = await banAffiliate({ affiliateId, reason: banReason.trim() });
      if (result.success) {
        setSuccess('Affiliate banned. All promo codes deactivated.');
        setConfirmAction(null);
      } else {
        setError(result.error ?? 'Ban failed');
      }
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'BANNED') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Management Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {status === 'SUSPENDED' && (
          <Button
            variant="outline"
            onClick={handleUnsuspend}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? 'Processing...' : 'Unsuspend Affiliate'}
          </Button>
        )}

        {status === 'ACTIVE' && confirmAction === null && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmAction('suspend')}
              className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              Suspend
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmAction('ban')}
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
            >
              Ban
            </Button>
          </div>
        )}

        {confirmAction === 'suspend' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="suspendReason" className="text-xs">Suspension reason</Label>
              <Textarea
                id="suspendReason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension..."
                className="mt-1"
                rows={3}
              />
              <p className="mt-0.5 text-xs text-gray-400">Minimum 10 characters.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSuspend}
                disabled={isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {isPending ? 'Processing...' : 'Confirm Suspend'}
              </Button>
            </div>
          </div>
        )}

        {confirmAction === 'ban' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="banReason" className="text-xs">Ban reason</Label>
              <Textarea
                id="banReason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban..."
                className="mt-1"
                rows={3}
              />
              <p className="mt-0.5 text-xs text-gray-400">Minimum 10 characters. All promo codes will be deactivated.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBan}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isPending ? 'Processing...' : 'Confirm Ban'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
