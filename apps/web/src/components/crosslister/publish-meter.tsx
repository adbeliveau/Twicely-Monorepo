'use client';

/**
 * PublishMeter — shows monthly publish usage with a progress bar and tier badge.
 * Source: F3 install prompt §3.8
 */

import { Badge } from '@twicely/ui/badge';
import Link from 'next/link';
import type { PublishAllowance } from '@twicely/crosslister/services/publish-meter';

interface PublishMeterProps {
  allowance: PublishAllowance;
}

function progressColor(usedPercent: number): string {
  if (usedPercent > 90) return 'bg-red-500';
  if (usedPercent > 75) return 'bg-amber-500';
  return 'bg-green-500';
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'FREE': return 'Crosslister Free';
    case 'LITE': return 'Crosslister Lite';
    case 'PRO':  return 'Crosslister Pro';
    default:     return 'No Crosslister';
  }
}

export function PublishMeter({ allowance }: PublishMeterProps) {
  if (allowance.tier === 'NONE') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Upgrade to Crosslister to crosslist</span>
        <Link href="/my/selling/subscription" className="text-primary underline-offset-4 hover:underline">
          Upgrade
        </Link>
      </div>
    );
  }

  const usedPercent = allowance.monthlyLimit > 0
    ? Math.min(100, Math.round((allowance.usedThisMonth / allowance.monthlyLimit) * 100))
    : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-[160px]">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{allowance.usedThisMonth} / {allowance.monthlyLimit} publishes this month</span>
          <span>{allowance.remaining} remaining</span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColor(usedPercent)}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>
      <Badge variant="secondary" className="whitespace-nowrap text-xs">
        {tierLabel(allowance.tier)}
      </Badge>
    </div>
  );
}

