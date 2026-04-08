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
  /** Server-read platform_settings value for listing.maxImagesPerListing. */
  maxImages?: number;
}

export function ListingFormWrapper({ mode, listingId, initialData, aiAutofillRemaining, maxImages }: ListingFormWrapperProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: ListingFormData, status: 'ACTIVE' | 'DRAFT') {
    if (mode === 'edit' && !listingId) throw new Error('listingId is required in edit mode');

    setIsSubmitting(true);
    setError(null);

    try {
      const result =
        mode === 'create'
          ? await createListing(data, status)
          : await updateListing(listingId!, data, status);

      if (result.success) {
        router.push('/my/selling/listings');
        router.refresh();
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
        setIsSubmitting(false);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <ListingForm
        initialData={initialData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        aiAutofillRemaining={aiAutofillRemaining}
        maxImages={maxImages}
      />
    </div>
  );
}
