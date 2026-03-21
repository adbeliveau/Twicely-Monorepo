'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { OfferStatusBadge } from '@/components/offers/offer-status-badge';
import { acceptOfferAction, declineOfferAction, counterOfferAction } from '@/lib/actions/offers';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@twicely/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@twicely/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@twicely/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import type { SellerOfferRow, OfferStatus } from '@/lib/queries/offers';

interface SellerOffersListProps {
  offers: SellerOfferRow[];
  total: number;
  page: number;
  perPage: number;
  currentStatus: OfferStatus | 'all';
  currentSort: 'newest' | 'highest';
}

const STATUS_TABS: { value: OfferStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
];

export function SellerOffersList({ offers, total, page, perPage, currentStatus, currentSort }: SellerOffersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [offerToDecline, setOfferToDecline] = useState<string | null>(null);
  const [counteringOfferId, setCounteringOfferId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const totalPages = Math.ceil(total / perPage);

  const navigate = (params: URLSearchParams) => router.push(`/my/selling/offers?${params.toString()}`);

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', status);
    params.set('page', '1');
    navigate(params);
  };

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    navigate(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    navigate(params);
  };

  const handleAccept = async (offerId: string) => {
    startTransition(async () => {
      const result = await acceptOfferAction({ offerId });
      if (result.success) {
        toast.success('Offer accepted! Order created.', {
          action: result.orderId ? { label: 'View Order', onClick: () => router.push(`/my/selling/orders/${result.orderId}`) } : undefined,
        });
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to accept offer');
      }
    });
  };

  const handleDecline = async () => {
    if (!offerToDecline) return;
    startTransition(async () => {
      const result = await declineOfferAction({ offerId: offerToDecline });
      if (result.success) {
        toast.success('Offer declined');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to decline offer');
      }
      setDeclineDialogOpen(false);
      setOfferToDecline(null);
    });
  };

  const handleCounter = async (offerId: string) => {
    const cents = Math.round(parseFloat(counterAmount) * 100);
    if (isNaN(cents) || cents < 100) {
      toast.error('Enter a valid amount (minimum $1.00)');
      return;
    }
    startTransition(async () => {
      const result = await counterOfferAction({ offerId, counterCents: cents });
      if (result.success) {
        toast.success('Counter offer sent');
        setCounteringOfferId(null);
        setCounterAmount('');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to send counter offer');
      }
    });
  };

  const openDeclineDialog = (offerId: string) => {
    setOfferToDecline(offerId);
    setDeclineDialogOpen(true);
  };

  const formatBuyerName = (name: string | null) => {
    if (!name) return 'Buyer';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ''}.`;
  };

  if (offers.length === 0 && currentStatus === 'all') {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No offers yet</h3>
        <p className="text-muted-foreground mt-2">When buyers make offers on your items, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={currentStatus} onValueChange={handleStatusChange}>
          <TabsList>
            {STATUS_TABS.map((tab) => (<TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>))}
          </TabsList>
        </Tabs>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="highest">Highest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No offers found with this status.</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
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
                          <div className="flex items-center justify-center h-full"><Package className="h-6 w-6 text-muted-foreground" /></div>
                        )}
                      </div>
                      <span className="font-medium line-clamp-1">{offer.listing.title || 'Untitled'}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{formatBuyerName(offer.buyerName)}</TableCell>
                  <TableCell>
                    <span className="font-semibold">{formatPrice(offer.offerCents)}</span>
                    {offer.listing.priceCents && (
                      <span className="text-muted-foreground text-sm ml-1">/ {formatPrice(offer.listing.priceCents)}</span>
                    )}
                  </TableCell>
                  <TableCell><OfferStatusBadge status={offer.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(offer.createdAt, 'relative')}</TableCell>
                  <TableCell className="text-right">
                    <OfferActions
                      offer={offer}
                      isPending={isPending}
                      onAccept={handleAccept}
                      onDecline={openDeclineDialog}
                      counteringOfferId={counteringOfferId}
                      setCounteringOfferId={setCounteringOfferId}
                      counterAmount={counterAmount}
                      setCounterAmount={setCounterAmount}
                      onCounter={handleCounter}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}</p>
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

      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this offer?</AlertDialogTitle>
            <AlertDialogDescription>The buyer will be notified and their payment hold will be released.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecline} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? 'Declining...' : 'Decline Offer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface OfferActionsProps {
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

function OfferActions({ offer, isPending, onAccept, onDecline, counteringOfferId, setCounteringOfferId, counterAmount, setCounterAmount, onCounter }: OfferActionsProps) {
  // COUNTERED waiting for buyer (seller sent counter)
  if (offer.status === 'COUNTERED') {
    return <span className="text-sm text-muted-foreground">Waiting for buyer</span>;
  }

  if (offer.status === 'ACCEPTED' && offer.orderId) {
    return <Button variant="outline" size="sm" asChild><Link href={`/my/selling/orders/${offer.orderId}`}>View Order</Link></Button>;
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
