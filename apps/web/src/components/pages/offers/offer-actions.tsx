import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import type { SellerOfferRow } from '@/lib/queries/offers';

export interface OfferActionsProps {
  offer: SellerOfferRow;
  isPending: boolean;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  counteringOfferId: string | null;
  setCounteringOfferId: (id: string | null) => void;
  counterAmount: string;
  setCounterAmount: (v: string) => void;
  onCounter: (id: string) => void;
}

export function OfferActions({
  offer, isPending, onAccept, onDecline,
  counteringOfferId, setCounteringOfferId,
  counterAmount, setCounterAmount, onCounter,
}: OfferActionsProps) {
  // COUNTERED waiting for buyer (seller sent counter)
  if (offer.status === 'COUNTERED') {
    return <span className="text-sm text-muted-foreground">Waiting for buyer</span>;
  }

  if (offer.status === 'ACCEPTED' && offer.orderId) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/my/selling/orders/${offer.orderId}`}>View Order</Link>
      </Button>
    );
  }

  if (offer.status !== 'PENDING') return null;

  if (counteringOfferId === offer.id) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative w-24">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            type="text"
            inputMode="decimal"
            value={counterAmount}
            onChange={(e) => setCounterAmount(e.target.value)}
            placeholder="0.00"
            className="pl-5 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => onCounter(offer.id)} disabled={isPending}>Send</Button>
        <Button size="sm" variant="ghost" onClick={() => { setCounteringOfferId(null); setCounterAmount(''); }}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onAccept(offer.id)} disabled={isPending}>Accept</Button>
      <Button size="sm" variant="destructive" onClick={() => onDecline(offer.id)} disabled={isPending}>Decline</Button>
      <Button size="sm" variant="outline" onClick={() => setCounteringOfferId(offer.id)} disabled={isPending}>Counter</Button>
    </div>
  );
}
