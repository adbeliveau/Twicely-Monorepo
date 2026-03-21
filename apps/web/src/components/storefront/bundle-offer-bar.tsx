'use client';

import { Package, X } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';

interface BundleOfferBarProps {
  selectedCount: number;
  totalPriceCents: number;
  onRequestBundle: () => void;
  onClear: () => void;
}

export function BundleOfferBar({
  selectedCount,
  totalPriceCents,
  onRequestBundle,
  onClear,
}: BundleOfferBarProps) {
  if (selectedCount < 2) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {selectedCount} items selected
            </p>
            <p className="text-sm text-muted-foreground">
              Total: {formatPrice(totalPriceCents)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
          <Button onClick={onRequestBundle}>
            Request Bundle Price
          </Button>
        </div>
      </div>
    </div>
  );
}
