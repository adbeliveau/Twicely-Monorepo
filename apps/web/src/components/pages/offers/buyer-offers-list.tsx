'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { OfferStatusBadge } from '@/components/offers/offer-status-badge';
import { InlineCardElement } from '@/components/offers/inline-card-element';
import { cancelOfferAction, acceptOfferAction, counterOfferAction } from '@/lib/actions/offers';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@twicely/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@twicely/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@twicely/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Package, Clock } from 'lucide-react';
import type { BuyerOfferRow, OfferStatus } from '@/lib/queries/offers';

interface BuyerOffersListProps {
  offers: BuyerOfferRow[];
  total: number;
  page: number;
  perPage: number;
  currentStatus: OfferStatus | 'all';
}

const STATUS_TABS: { value: OfferStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELED', label: 'Cancelled' },
];

export function BuyerOffersList({ offers, total, page, perPage, currentStatus }: BuyerOffersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [offerToCancel, setOfferToCancel] = useState<string | null>(null);
  const totalPages = Math.ceil(total / perPage);

  const navigate = (params: URLSearchParams) => router.push(`/my/buying/offers?${params.toString()}`);

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', status);
    params.set('page', '1');
    navigate(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    navigate(params);
  };

  const handleCancelOffer = async () => {
    if (!offerToCancel) return;
    startTransition(async () => {
      const result = await cancelOfferAction({ offerId: offerToCancel });
      if (result.success) {
        toast.success('Offer cancelled');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to cancel offer');
      }
      setCancelDialogOpen(false);
      setOfferToCancel(null);
    });
  };

  const openCancelDialog = (offerId: string) => {
    setOfferToCancel(offerId);
    setCancelDialogOpen(true);
  };

  if (offers.length === 0 && currentStatus === 'all') {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No offers yet</h3>
        <p className="text-muted-foreground mt-2">
          You haven&apos;t made any offers yet. Browse listings to find items you want.
        </p>
        <Button asChild className="mt-4">
          <Link href="/">Browse Listings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={currentStatus} onValueChange={handleStatusChange}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {offers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No offers found with this status.</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <Link href={`/i/${offer.listing.slug}`} className="flex items-center gap-3 hover:underline">
                      <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                        {offer.thumbnail ? (
                          <Image src={offer.thumbnail} alt={offer.listing.title || 'Item'} fill className="object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium line-clamp-1">{offer.listing.title || 'Untitled'}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">{formatPrice(offer.offerCents)}</span>
                    {offer.listing.priceCents && (
                      <span className="text-muted-foreground text-sm ml-1">/ {formatPrice(offer.listing.priceCents)}</span>
                    )}
                  </TableCell>
                  <TableCell><OfferStatusBadge status={offer.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(offer.createdAt, 'relative')}</TableCell>
                  <TableCell className="text-right">
                    <OfferActions offer={offer} onCancel={openCancelDialog} isPending={isPending} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this offer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will release your payment hold and withdraw the offer. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Offer</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOffer} disabled={isPending}>
              {isPending ? 'Cancelling...' : 'Cancel Offer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OfferActions({ offer, onCancel, isPending }: { offer: BuyerOfferRow; onCancel: (id: string) => void; isPending: boolean }) {
  const router = useRouter();
  const [showAccept, setShowAccept] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declining, startDecline] = useTransition();

  // PENDING offer the buyer made — can cancel
  if (offer.status === 'PENDING' && offer.counterByRole !== 'SELLER') {
    return <Button variant="outline" size="sm" onClick={() => onCancel(offer.id)} disabled={isPending}>Cancel</Button>;
  }

  // PENDING offer where seller countered — buyer's turn to respond
  if (offer.status === 'PENDING' && offer.counterByRole === 'SELLER') {
    const handleAccept = async (pmId: string) => {
      const result = await acceptOfferAction({ offerId: offer.id, paymentMethodId: pmId });
      if (result.success) {
        toast.success('Offer accepted!', { action: result.orderId ? { label: 'View Order', onClick: () => router.push(`/my/buying/orders/${result.orderId}`) } : undefined });
        router.refresh();
        return { success: true };
      }
      return { success: false, error: result.error };
    };

    const handleCounter = async (pmId: string) => {
      const cents = Math.round(parseFloat(counterAmount || '0') * 100);
      if (cents <= 0) return { success: false, error: 'Enter a valid amount' };
      const result = await counterOfferAction({ offerId: offer.id, counterCents: cents, paymentMethodId: pmId });
      if (result.success) {
        toast.success('Counter sent!');
        router.refresh();
        setShowCounter(false);
        return { success: true };
      }
      return { success: false, error: result.error };
    };

    const handleDecline = () => {
      startDecline(async () => {
        const result = await cancelOfferAction({ offerId: offer.id });
        if (result.success) { toast.success('Offer declined'); router.refresh(); }
        else toast.error(result.error || 'Failed');
        setDeclineOpen(false);
      });
    };

    if (showAccept) {
      return (
        <div className="w-48">
          <InlineCardElement onSubmit={handleAccept} submitLabel="Confirm Accept" submitVariant="default" />
          <Button variant="ghost" size="sm" onClick={() => setShowAccept(false)} className="w-full mt-1">Cancel</Button>
        </div>
      );
    }
    if (showCounter) {
      return (
        <div className="w-48 space-y-2">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input type="text" inputMode="decimal" value={counterAmount} onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setCounterAmount(e.target.value); }} placeholder="0.00" className="pl-6 h-8" />
          </div>
          <InlineCardElement onSubmit={handleCounter} submitLabel="Send Counter" submitVariant="default" />
          <Button variant="ghost" size="sm" onClick={() => setShowCounter(false)} className="w-full">Cancel</Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button size="sm" variant="default" onClick={() => setShowAccept(true)}>Accept</Button>
          <Button size="sm" variant="destructive" onClick={() => setDeclineOpen(true)}>Decline</Button>
          <Button size="sm" variant="outline" onClick={() => setShowCounter(true)}>Counter</Button>
        </div>
        <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Decline this counter?</AlertDialogTitle>
              <AlertDialogDescription>This will end the negotiation. You can make a new offer later.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Negotiating</AlertDialogCancel>
              <AlertDialogAction onClick={handleDecline} disabled={declining}>{declining ? 'Declining...' : 'Decline'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // PENDING offer where buyer already countered — waiting for seller
  if (offer.status === 'PENDING' && offer.counterByRole === 'BUYER') {
    return <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Waiting for seller</span>;
  }

  if (offer.status === 'ACCEPTED' && offer.orderId) {
    return <Button variant="outline" size="sm" asChild><Link href={`/my/buying/orders/${offer.orderId}`}>View Order</Link></Button>;
  }
  if (offer.status === 'COUNTERED') {
    return <Button variant="outline" size="sm" asChild><Link href={`/i/${offer.listing.slug}`}>View</Link></Button>;
  }
  return null;
}
