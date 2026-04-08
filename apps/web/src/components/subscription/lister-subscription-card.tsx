'use client';

/**
 * F4-S4: ListerSubscriptionCard
 *
 * Specialized card for the Crosslister product on /my/selling/subscription.
 * States: NONE, FREE (with tier upgrade CTAs), LITE/PRO (active), PAST_DUE.
 * Self-contained: handles subscribe and overage actions internally.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { CancelSubscriptionDialog } from './cancel-subscription-dialog';
import { createSubscriptionCheckout } from '@/lib/actions/create-subscription-checkout';
import { purchaseOveragePack } from '@/lib/actions/purchase-overage-pack';
import { cn } from '@twicely/utils';
import Link from 'next/link';
import type { ListerSubscriptionSnapshot } from '@/lib/queries/lister-subscription';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListerSubscriptionCardProps {
  snapshot: ListerSubscriptionSnapshot;
  isSubscribing?: boolean;
  onSubscribe?: (tier: string, interval: 'monthly' | 'annual') => void;
  onPurchaseOverage?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LISTER_UPGRADE_TIERS = [
  {
    tier: 'LITE',
    label: 'Lite',
    features: ['200 publishes/mo', '25 AI credits', '25 BG removals', '60-day rollover'],
  },
  {
    tier: 'PRO',
    label: 'Pro',
    features: ['2,000 publishes/mo', '200 AI credits', '200 BG removals', '60-day rollover'],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function meterColor(usedPercent: number): string {
  if (usedPercent > 90) return 'bg-red-500';
  if (usedPercent > 75) return 'bg-amber-500';
  return 'bg-green-500';
}

function tierLabel(tier: string): string {
  if (tier === 'FREE') return 'Free';
  if (tier === 'LITE') return 'Lite';
  if (tier === 'PRO') return 'Pro';
  return tier;
}

// ─── Publish Meter Bar ────────────────────────────────────────────────────────

interface PublishMeterBarProps {
  used: number;
  monthlyLimit: number;
  rolloverBalance: number;
  remaining: number;
}

function PublishMeterBar({ used, monthlyLimit, rolloverBalance, remaining }: PublishMeterBarProps) {
  const total = monthlyLimit + rolloverBalance;
  const usedPercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used} / {total} publishes</span>
        <span>{remaining} remaining</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', meterColor(usedPercent))}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      {rolloverBalance > 0 && (
        <p className="text-xs text-muted-foreground">
          (includes {rolloverBalance} rollover)
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ListerSubscriptionCard({
  snapshot,
  onSubscribe,
  onPurchaseOverage,
}: ListerSubscriptionCardProps) {
  const { listerTier, publishAllowance, subscription, connectedPlatformCount } = snapshot;
  const status = subscription?.status ?? null;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const periodEnd = subscription?.currentPeriodEnd ?? null;

  const [busy, setBusy] = useState(false);

  // ─── Internal action handlers ──────────────────────────────────────────────

  async function handleSubscribe(tier: string, interval: 'monthly' | 'annual') {
    if (onSubscribe) {
      onSubscribe(tier, interval);
      return;
    }
    setBusy(true);
    try {
      const result = await createSubscriptionCheckout({ product: 'lister', tier, interval });
      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    } catch {
      toast.error('Failed to start checkout');
    } finally {
      setBusy(false);
    }
  }

  async function handlePurchaseOverage() {
    if (onPurchaseOverage) {
      onPurchaseOverage();
      return;
    }
    setBusy(true);
    try {
      const result = await purchaseOveragePack({ packType: 'publishes' });
      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    } catch {
      toast.error('Failed to start checkout');
    } finally {
      setBusy(false);
    }
  }

  // ─── State A: NONE ──────────────────────────────────────────────────────────

  if (listerTier === 'NONE') {
    return (
      <Card className="border-l-4 border-l-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Crosslister</CardTitle>
          <p className="text-sm text-muted-foreground">
            Import your listings for free from any platform. Get 5 publishes / 6 months with the free plan.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/my/selling/crosslist/import">Import Your Listings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── State D: PAST_DUE ──────────────────────────────────────────────────────

  if (status === 'PAST_DUE') {
    return (
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Crosslister</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">
            Payment failed. Please update your payment method to restore your crosslisting.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/my/selling/subscription">Update Payment Method</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── State B: FREE ──────────────────────────────────────────────────────────

  if (listerTier === 'FREE') {
    return (
      <Card className="border-l-4 border-l-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Crosslister</CardTitle>
            <Badge variant="secondary">Free</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PublishMeterBar
            used={publishAllowance.usedThisMonth}
            monthlyLimit={publishAllowance.monthlyLimit}
            rolloverBalance={0}
            remaining={publishAllowance.remaining}
          />
          <div className="space-y-3">
            {LISTER_UPGRADE_TIERS.map((t) => (
              <div key={t.tier} className="border rounded p-3 space-y-2">
                <span className="font-medium">{t.label}</span>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {t.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => { void handleSubscribe(t.tier, 'monthly'); }}
                  >
                    Monthly
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => { void handleSubscribe(t.tier, 'annual'); }}
                  >
                    Annual (Save 20%)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── State C: LITE or PRO (active) ─────────────────────────────────────────

  return (
    <Card className="border-l-4 border-l-[#7C3AED]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Crosslister</CardTitle>
          <Badge className="bg-[#7C3AED] hover:bg-[#7C3AED]">{tierLabel(listerTier)}</Badge>
        </div>
        {connectedPlatformCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {connectedPlatformCount} platform{connectedPlatformCount !== 1 ? 's' : ''} connected
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {cancelAtPeriodEnd && periodEnd && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">
            Your subscription ends on {formatDate(periodEnd)}
          </p>
        )}
        {!cancelAtPeriodEnd && periodEnd && (
          <p className="text-sm text-muted-foreground">
            Renews {formatDate(periodEnd)}
          </p>
        )}
        <PublishMeterBar
          used={publishAllowance.usedThisMonth}
          monthlyLimit={publishAllowance.monthlyLimit}
          rolloverBalance={publishAllowance.rolloverBalance}
          remaining={publishAllowance.remaining}
        />
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => { void handlePurchaseOverage(); }}
          >
            Buy +500 Publishes ($9)
          </Button>
          {!cancelAtPeriodEnd && (
            <CancelSubscriptionDialog
              product="lister"
              productLabel="Crosslister"
              currentStoreTier="NONE"
              periodEndDate={periodEnd}
              revertTier="FREE"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
