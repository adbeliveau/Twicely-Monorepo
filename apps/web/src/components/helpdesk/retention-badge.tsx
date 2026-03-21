"use client";

import { cn } from "@/lib/utils";

interface RetentionBadgeProps {
  closedAt: Date | null;
  resolvedAt: Date | null;
  retentionDays: number;
  autoCloseDays: number;
}

function getDaysRemaining(from: Date | null, addDays: number): number {
  if (!from) return addDays;
  const deleteAt = new Date(from.getTime() + addDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.floor((deleteAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function getBadgeClass(days: number): string {
  if (days < 7) return "bg-red-500/20 text-red-600 animate-pulse";
  if (days < 30) return "bg-red-500/20 text-red-600";
  if (days <= 90) return "bg-amber-500/20 text-amber-600";
  return "bg-green-500/20 text-green-600";
}

export function RetentionBadge({
  closedAt,
  resolvedAt,
  retentionDays,
  autoCloseDays,
}: RetentionBadgeProps) {
  if (closedAt) {
    const days = getDaysRemaining(closedAt, retentionDays);
    const label = days <= 0 ? "Deletes soon" : `Deletes in ${days} days`;
    return (
      <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getBadgeClass(days))}>
        {label}
      </span>
    );
  }

  if (resolvedAt) {
    const days = getDaysRemaining(resolvedAt, autoCloseDays);
    const label = days <= 0 ? "Auto-closes soon" : `Auto-closes in ${days} days`;
    return (
      <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getBadgeClass(days))}>
        {label}
      </span>
    );
  }

  return null;
}
