'use client';

/**
 * D3-S3: Cancel Subscription Confirmation Dialog
 *
 * Shows downgrade warnings from subscription-engine, confirms cancel_at_period_end.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@twicely/ui/alert-dialog';
import { Button } from '@twicely/ui/button';
import { getDowngradeWarnings } from '@twicely/subscriptions/subscription-engine';
import { cancelSubscriptionAction } from '@/lib/actions/manage-subscription';
import type { StoreTier } from '@/types/enums';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CancelSubscriptionDialogProps {
  product: 'store' | 'lister' | 'automation' | 'finance' | 'bundle';
  productLabel: string;
  currentStoreTier: StoreTier;
  periodEndDate: Date | null;
  revertTier: string;
}

// ─── Revert tier labels ─────────────────────────────────────────────────────

const REVERT_LABELS: Record<string, string> = {
  NONE: 'No active subscription',
  FREE: 'Free plan',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CancelSubscriptionDialog(props: CancelSubscriptionDialogProps) {
  const { product, productLabel, currentStoreTier, periodEndDate, revertTier } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const warnings = getDowngradeWarnings({
    currentStoreTier,
    targetStoreTier: (product === 'store' || product === 'bundle') ? 'NONE' : currentStoreTier,
  });

  const endDateStr = periodEndDate
    ? new Date(periodEndDate).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : 'the end of your billing period';

  const revertLabel = REVERT_LABELS[revertTier] ?? revertTier;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const result = await cancelSubscriptionAction({ product });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? 'Something went wrong');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-600">
          Cancel Subscription
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {productLabel} Subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            Your subscription will remain active until {endDateStr}.
            After that, you&apos;ll be downgraded to {revertLabel}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {warnings.length > 0 && (
          <div className="space-y-2 my-2">
            {warnings.map((w) => (
              <div
                key={w.feature}
                className="text-sm bg-amber-50 border border-amber-200 rounded p-2"
              >
                <span className="font-medium">{w.feature}:</span> {w.message}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Subscription</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Canceling...' : 'Yes, Cancel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
