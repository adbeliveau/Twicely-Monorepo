'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@twicely/ui/button';

interface ListingFormActionsProps {
  isSubmitting?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export function ListingFormActions({
  isSubmitting,
  onSaveDraft,
  onPublish,
}: ListingFormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={onSaveDraft}
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save as Draft
      </Button>
      <Button type="button" onClick={onPublish} disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Publish Listing
      </Button>
    </div>
  );
}
