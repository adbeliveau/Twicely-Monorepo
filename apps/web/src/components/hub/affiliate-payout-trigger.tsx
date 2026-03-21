'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { triggerAffiliatePayoutManually } from '@/lib/actions/affiliate-payout-admin';

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function AffiliatePayoutTrigger() {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    graduatedCount?: number;
    payoutCount?: number;
    totalPaidCents?: number;
    error?: string;
  } | null>(null);

  function handleTrigger() {
    startTransition(async () => {
      const res = await triggerAffiliatePayoutManually();
      setResult(res);
      setShowConfirm(false);
    });
  }

  if (result) {
    return (
      <Card>
        <CardContent className="pt-6">
          {result.success ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-green-700">Payout job completed successfully.</p>
              <p className="text-gray-600">
                Commissions graduated: <span className="font-medium">{result.graduatedCount ?? 0}</span>
              </p>
              <p className="text-gray-600">
                Payouts executed: <span className="font-medium">{result.payoutCount ?? 0}</span>
              </p>
              <p className="text-gray-600">
                Total paid:{' '}
                <span className="font-medium">{formatCents(result.totalPaidCents ?? 0)}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setResult(null)}
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-red-700">Payout job failed.</p>
              <p className="text-gray-600">{result.error ?? 'Unknown error'}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setResult(null)}
              >
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (showConfirm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirm Manual Payout Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            This will graduate all eligible commissions and execute payouts for all affiliates with
            available balances above the minimum threshold. This action is audited.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTrigger}
              disabled={isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? 'Running...' : 'Confirm Run'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => setShowConfirm(true)}
      disabled={isPending}
    >
      Run Payout Job
    </Button>
  );
}
