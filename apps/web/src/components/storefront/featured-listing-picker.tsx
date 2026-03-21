'use client';

import { useState } from 'react';
import { Plus, X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@twicely/ui/dialog';
import { cn } from '@twicely/utils/cn';

interface AvailableListing {
  id: string;
  title: string;
  imageUrl: string | null;
  priceCents: number;
}

interface FeaturedListingPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  availableListings: AvailableListing[];
}

export function FeaturedListingPicker({
  selectedIds,
  onChange,
  availableListings,
}: FeaturedListingPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const maxFeatured = 6;

  const selectedListings = selectedIds
    .map((id) => availableListings.find((l) => l.id === id))
    .filter(Boolean) as AvailableListing[];

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...selectedIds];
    const temp = newIds[index - 1]!;
    newIds[index - 1] = newIds[index]!;
    newIds[index] = temp;
    onChange(newIds);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedIds.length - 1) return;
    const newIds = [...selectedIds];
    const temp = newIds[index]!;
    newIds[index] = newIds[index + 1]!;
    newIds[index + 1] = temp;
    onChange(newIds);
  };

  const handleSelect = (id: string) => {
    if (!selectedIds.includes(id) && selectedIds.length < maxFeatured) {
      onChange([...selectedIds, id]);
      setDialogOpen(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-3">
      {selectedListings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No featured listings selected. Add up to 6.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {selectedListings.map((listing, index) => (
            <div key={listing.id} className="relative group border rounded-lg p-2">
              <div className="aspect-square w-20 mx-auto bg-muted rounded overflow-hidden">
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No image
                  </div>
                )}
              </div>
              <p className="text-xs mt-1 truncate text-center">{listing.title}</p>
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon-xs" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => handleMoveDown(index)} disabled={index === selectedIds.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => handleRemove(listing.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={selectedIds.length >= maxFeatured}>
            <Plus className="h-4 w-4 mr-1" /> Add Featured
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Featured Listings</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto grid grid-cols-2 gap-2 mt-2">
            {availableListings.map((listing) => {
              const isSelected = selectedIds.includes(listing.id);
              return (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => handleSelect(listing.id)}
                  disabled={isSelected}
                  className={cn(
                    'relative border rounded-lg p-2 text-left transition-colors',
                    isSelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
                  )}
                >
                  <div className="aspect-square w-full bg-muted rounded overflow-hidden">
                    {listing.imageUrl ? (
                      <img src={listing.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-1 truncate">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(listing.priceCents)}</p>
                  {isSelected && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
