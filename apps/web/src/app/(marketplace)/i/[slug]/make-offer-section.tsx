'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@twicely/ui/button';
import { MessageSquare } from 'lucide-react';

const OfferModal = dynamic(
  () => import('@/components/offers/offer-modal').then((mod) => mod.OfferModal),
  { ssr: false }
);

interface ListingData {
  id: string;
  title: string;
  priceCents: number;
  images: Array<{ url: string }>;
  allowOffers: boolean;
  autoAcceptOfferCents: number | null;
  autoDeclineOfferCents: number | null;
}

interface AddressOption {
  id: string;
  label: string | null;
  name: string;
  isDefault: boolean;
}

interface MakeOfferSectionProps {
  listing: ListingData;
  addresses: AddressOption[];
  pendingOfferCount: number;
}

export function MakeOfferSection({ listing, addresses, pendingOfferCount }: MakeOfferSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        size="lg"
        onClick={() => setIsModalOpen(true)}
      >
        <MessageSquare className="mr-2 h-5 w-5" />
        Make an Offer
      </Button>

      {pendingOfferCount > 0 && (
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {pendingOfferCount} offer{pendingOfferCount === 1 ? '' : 's'} pending
        </p>
      )}

      <OfferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        listing={listing}
        addresses={addresses}
      />
    </>
  );
}
