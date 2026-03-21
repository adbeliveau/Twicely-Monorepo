'use client';

/**
 * F4-S4: PublishMeterDisplay
 *
 * Lightweight publish meter for the crosslister dashboard.
 * Shows usage, rollover, warnings, and upgrade prompts.
 */

import { cn } from '@twicely/utils';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublishMeterDisplayProps {
  publishAllowance: {
    tier: string;
    monthlyLimit: number;
    usedThisMonth: number;
    remaining: number;
    rolloverBalance: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function meterColor(usedPercent: number): string {
  if (usedPercent > 90) return 'bg-red-500';
  if (usedPercent > 75) return 'bg-amber-500';
  return 'bg-green-500';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PublishMeterDisplay({ publishAllowance }: PublishMeterDisplayProps) {
  const { tier, monthlyLimit, usedThisMonth, remaining, rolloverBalance } = publishAllowance;

  if (tier === 'NONE') {
    return (
      <div className="text-sm text-muted-foreground">
        Enable crosslisting by importing your first listings
      </div>
    );
  }

  const total = monthlyLimit + rolloverBalance;
  const usedPercent = total > 0 ? Math.min(100, Math.round((usedThisMonth / total) * 100)) : 0;
  const isRunningLow = total > 0 && remaining / total < 0.2 && remaining > 0;
  const isExhausted = remaining === 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{usedThisMonth} of {monthlyLimit} publishes used this month</span>
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
          + {rolloverBalance} rollover credits available
        </p>
      )}

      {isExhausted && (
        <p className="text-xs text-red-600">
          No publishes remaining.{' '}
          <Link href="/my/selling/subscription" className="underline underline-offset-2">
            Upgrade your plan
          </Link>
        </p>
      )}

      {!isExhausted && isRunningLow && (
        <p className="text-xs text-amber-600">
          Running low on publishes
        </p>
      )}
    </div>
  );
}
