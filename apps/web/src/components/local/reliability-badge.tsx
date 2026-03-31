/** Counterparty reliability data from getReliabilityDisplay */
export interface CounterpartyReliability {
  tier: 'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE';
  completedCount: number;
  completionRate: number;
  isSuspended: boolean;
  suspendedUntil: Date | null;
}

const RELIABILITY_CONFIG: Record<string, { label: string; color: string }> = {
  RELIABLE: { label: 'Reliable', color: 'bg-green-100 text-green-800' },
  INCONSISTENT: { label: 'Inconsistent', color: 'bg-yellow-100 text-yellow-800' },
  UNRELIABLE: { label: 'Unreliable', color: 'bg-red-100 text-red-800' },
};

interface ReliabilityBadgeProps {
  reliability: CounterpartyReliability;
  /** The role of the viewer (determines "Seller" vs "Buyer" label) */
  viewerRole: 'BUYER' | 'SELLER';
}

/**
 * G2.8 — Counterparty reliability indicator for local meetup screens.
 * Shows tier badge + completed count + completion rate.
 */
export function ReliabilityBadge({ reliability, viewerRole }: ReliabilityBadgeProps) {
  const config = RELIABILITY_CONFIG[reliability.tier];
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        {viewerRole === 'BUYER' ? 'Seller' : 'Buyer'} reliability
      </span>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config?.color ?? ''}`}>
          {config?.label ?? reliability.tier}
        </span>
        <span className="text-xs text-muted-foreground">
          {reliability.completedCount} meetups · {Math.round(reliability.completionRate * 100)}%
        </span>
      </div>
    </div>
  );
}
