'use client';

import { useTransition } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { publishStorefront, unpublishStorefront } from '@/lib/actions/storefront';

function GateItem({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-red-500" />
      )}
      <span className={passed ? 'text-gray-700' : 'text-gray-500'}>{label}</span>
    </div>
  );
}

interface PublishToggleProps {
  isPublished: boolean;
  sellerType: string;
  storeName: string | null;
  storeSlug: string | null;
  activeListingCount: number;
}

export function PublishToggle({
  isPublished,
  sellerType,
  storeName,
  storeSlug,
  activeListingCount,
}: PublishToggleProps) {
  const [isPending, startTransition] = useTransition();

  const isBusiness = sellerType === 'BUSINESS';
  const hasStoreName = !!storeName;
  const hasStoreSlug = !!storeSlug;
  const hasListings = activeListingCount > 0;
  const allGatesPass = isBusiness && hasStoreName && hasStoreSlug && hasListings;

  const handleToggle = () => {
    startTransition(async () => {
      if (isPublished) {
        await unpublishStorefront();
      } else {
        await publishStorefront();
      }
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Publish Your Store</h3>
        {isPublished && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Published
          </span>
        )}
      </div>

      <div className="space-y-2">
        <GateItem passed={isBusiness} label="Business seller status" />
        <GateItem passed={hasStoreName && hasStoreSlug} label="Store name and URL set" />
        <GateItem passed={hasListings} label="At least 1 active listing" />
      </div>

      <div className="flex gap-2">
        {isPublished ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Unpublish
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleToggle}
            disabled={isPending || !allGatesPass}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Publish Store
          </Button>
        )}
      </div>
    </div>
  );
}
