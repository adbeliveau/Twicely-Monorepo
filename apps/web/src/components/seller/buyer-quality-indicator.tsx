import { cn } from '@twicely/utils';
import { CheckCircle2 } from 'lucide-react';

/**
 * Buyer Trust Signals — Decision #142
 *
 * Replaces the old GREEN/YELLOW/RED tier indicator with factual data:
 * purchase count, member since, verified badge, returns/disputes if any.
 */

export interface BuyerTrustSignalsProps {
  completedPurchases: number;
  memberSince: Date;
  verified: boolean;
  repeatBuyer?: boolean;
  returns90d?: number;
  disputes90d?: number;
  className?: string;
}

export function BuyerTrustSignals({
  completedPurchases,
  memberSince,
  verified,
  repeatBuyer,
  returns90d = 0,
  disputes90d = 0,
  className,
}: BuyerTrustSignalsProps) {
  const year = memberSince.getFullYear();

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span>{completedPurchases} purchase{completedPurchases !== 1 ? 's' : ''}</span>
      <span className="text-muted-foreground/40">·</span>
      <span>Since {year}</span>
      {verified && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <CheckCircle2 className="h-3 w-3 text-blue-500" />
        </>
      )}
      {repeatBuyer && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-blue-600 font-medium">Repeat buyer</span>
        </>
      )}
      {returns90d > 0 && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-amber-600">{returns90d} return{returns90d !== 1 ? 's' : ''}</span>
        </>
      )}
      {disputes90d > 0 && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-red-600">{disputes90d} dispute{disputes90d !== 1 ? 's' : ''}</span>
        </>
      )}
    </span>
  );
}
