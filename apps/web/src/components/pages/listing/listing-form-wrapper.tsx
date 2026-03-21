'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListingForm } from './listing-form';
import { createListing, updateListing } from '@/lib/actions/listings';
import type { ListingFormData } from '@/types/listing-form';

interface ListingFormWrapperProps {
  mode: 'create' | 'edit';
  listingId?: string;
  initialData?: Partial<ListingFormData>;
  aiAutofillRemaining?: number;
}

export function ListingFormWrapper({ mode, listingId, initialData, aiAutofillRemaining }: ListingFormWrapperProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: ListingFormData, status: 'ACTIVE' | 'DRAFT') {
    if (mode === 'edit' && !listingId) throw new Error('listingId is required in edit mode');

    setIsSubmitting(true);

    try {
      const result =
        mode === 'create'
          ? await createListing(data, status)
          : await updateListing(listingId!, data, status);

      if (result.success) {
        router.push('/my/selling/listings');
        router.refresh();
      } else {
        // TODO: Show error toast
        setIsSubmitting(false);
      }
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <ListingForm
      initialData={initialData}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      aiAutofillRemaining={aiAutofillRemaining}
    />
  );
}
