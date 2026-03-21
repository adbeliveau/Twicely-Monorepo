'use client';

/**
 * D3-S3: SubscriptionCard
 *
 * Reusable card for each subscription product.
 * States: no-sub, active, past-due, cannot-subscribe.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { cn } from '@twicely/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AvailableTier {
  tier: string;
  label: string;
  monthlyPrice: string;
  annualPrice: string;
  annualSavings: number;
  features: string[];
}

export interface SubscriptionCardProps {
  title: string;
  product: 'store' | 'lister' | 'finance' | 'automation';
  currentTier: string;
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: Date | null;
  availableTiers: AvailableTier[];
  onSubscribe: (tier: string, interval: 'monthly' | 'annual') => void;
  cancelAction?: React.ReactNode;
  canSubscribe: boolean;
  disabledReason?: string;
  isUpgradeAvailable: boolean;
  // D3-S4: Pending downgrade info
  pendingTier?: string | null;
  pendingBillingInterval?: 'monthly' | 'annual' | null;
  pendingChangeAt?: Date | null;
  // D3-S4: Current billing interval
  billingInterval?: 'monthly' | 'annual' | null;
  // D3-S4: Change plan handler
  onChangePlan?: () => void;
  // D3-S4: Cancel pending change handler
  onCancelPendingChange?: () => void;
  // D3-S5: Bundle indicator
  bundleLabel?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusDot({ status }: { status: string | null }) {
  const color = status === 'ACTIVE' ? 'bg-green-500'
    : status === 'TRIALING' ? 'bg-blue-500'
    : status === 'PAST_DUE' ? 'bg-yellow-500'
    : 'bg-gray-400';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />;
}

export function statusLabel(status: string | null): string {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'TRIALING') return 'Trialing';
  if (status === 'PAST_DUE') return 'Past Due';
  if (status === 'CANCELED') return 'Canceled';
  return 'Inactive';
}

export const isActive = (s: string | null) => s === 'ACTIVE' || s === 'TRIALING';
export const isPastDue = (s: string | null) => s === 'PAST_DUE';
export const isFreeOrNone = (t: string) => t === 'NONE' || t === 'FREE';

// ─── Component ──────────────────────────────────────────────────────────────

export function SubscriptionCard(props: SubscriptionCardProps) {
  const {
    title, currentTier, status, currentPeriodEnd, cancelAtPeriodEnd,
    trialEndsAt, availableTiers, onSubscribe, cancelAction, canSubscribe,
    disabledReason, isUpgradeAvailable, pendingTier, pendingBillingInterval,
    pendingChangeAt, onChangePlan, onCancelPendingChange, bundleLabel,
  } = props;

  // D3-S5: Included in bundle — show tier badge, no actions
  if (bundleLabel) {
    return (
      <Card className="border-l-4 border-l-[#7C3AED]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge className="bg-[#7C3AED] hover:bg-[#7C3AED]">{currentTier}</Badge>
          </div>
          <Badge variant="outline" className="w-fit text-xs border-purple-300 text-purple-700">
            Included in {bundleLabel}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Managed through your bundle subscription</p>
        </CardContent>
      </Card>
    );
  }

  const borderColor = isPastDue(status) ? 'border-l-red-500'
    : isActive(status) ? 'border-l-[#7C3AED]'
    : 'border-l-gray-200';

  // State A: No subscription
  if (isFreeOrNone(currentTier) && !isActive(status)) {
    return (
      <Card className="border-l-4 border-l-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {currentTier === 'FREE' ? 'Free Plan' : 'No active subscription'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canSubscribe && disabledReason && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">{disabledReason}</p>
          )}
          {availableTiers.map((t) => (
            <div key={t.tier} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.label}</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {t.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" disabled={!canSubscribe}
                  onClick={() => onSubscribe(t.tier, 'monthly')}
                >
                  Monthly {t.monthlyPrice}
                </Button>
                <Button
                  size="sm" disabled={!canSubscribe}
                  onClick={() => onSubscribe(t.tier, 'annual')}
                >
                  Annual {t.annualPrice} (Save {t.annualSavings}%)
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // State B/C: Active, Trialing, or Past Due
  return (
    <Card className={cn('border-l-4', borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {isActive(status) && (
            <Badge className="bg-[#7C3AED] hover:bg-[#7C3AED]">{currentTier}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <StatusDot status={status} />
          <span>{statusLabel(status)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Past due warning */}
        {isPastDue(status) && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">
            Payment failed. Please update your payment method.
          </p>
        )}

        {/* Cancel pending banner */}
        {cancelAtPeriodEnd && currentPeriodEnd && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">
            Cancels on {formatDate(currentPeriodEnd)}
          </p>
        )}

        {/* D3-S4: Pending downgrade banner */}
        {(pendingTier || pendingBillingInterval) && !cancelAtPeriodEnd && (
          <div className="flex items-center justify-between text-sm bg-amber-50 border border-amber-200 rounded p-2">
            <span className="text-amber-700">
              Changing to {pendingTier ?? currentTier}
              {pendingBillingInterval ? ` (${pendingBillingInterval})` : ''}
              {pendingChangeAt ? ` on ${formatDate(pendingChangeAt)}` : ''}
            </span>
            {onCancelPendingChange && (
              <Button size="sm" variant="ghost" className="text-amber-700 h-auto py-0.5 px-2"
                onClick={onCancelPendingChange}>
                Cancel Change
              </Button>
            )}
          </div>
        )}

        {/* Renewal / trial info */}
        {!cancelAtPeriodEnd && status === 'TRIALING' && trialEndsAt && (
          <p className="text-sm text-muted-foreground">
            Trial ends {formatDate(trialEndsAt)}
          </p>
        )}
        {!cancelAtPeriodEnd && status === 'ACTIVE' && currentPeriodEnd && (
          <p className="text-sm text-muted-foreground">
            Renews {formatDate(currentPeriodEnd)}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {isUpgradeAvailable && onChangePlan && (
            <Button size="sm" variant="outline" onClick={onChangePlan}>
              Change Plan
            </Button>
          )}
          {isActive(status) && !cancelAtPeriodEnd && cancelAction}
        </div>
      </CardContent>
    </Card>
  );
}
