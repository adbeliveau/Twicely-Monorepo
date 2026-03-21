import { MapPin } from 'lucide-react';
import { Card } from '@twicely/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalMeetupStatsProps {
  completedCount: number;
  completionRate: number; // 0.0 to 1.0
  responseLabel: string | null;
  variant: 'storefront' | 'listing-detail';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Read-only display for local seller meetup metrics.
 * Used on seller storefront header (storefront variant) and
 * listing detail seller card (listing-detail variant).
 *
 * Privacy: does NOT show reliability tier badge or raw mark count.
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A14.
 */
export function LocalMeetupStats({
  completedCount,
  completionRate,
  responseLabel,
  variant,
}: LocalMeetupStatsProps) {
  const completionPct = Math.round(completionRate * 100);

  if (variant === 'listing-detail') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span>
          Local Pickup · {completedCount} meetups · {completionPct}% completion
        </span>
      </div>
    );
  }

  // storefront variant — full display in shadcn Card
  return (
    <Card className="mt-4 px-4 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        <span>Local Meetups</span>
      </div>
      <p className="mt-0.5">
        {completedCount} completed · {completionPct}% completion rate
      </p>
      {responseLabel !== null && (
        <p className="mt-0.5">Usually responds {responseLabel}</p>
      )}
    </Card>
  );
}
