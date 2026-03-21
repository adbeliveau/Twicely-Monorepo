'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import { AddressForm } from './address-form';
import { createAddress } from '@/lib/actions/addresses';
import type { AddressData } from '@/lib/queries/address';
import type { AddressFormData } from '@/lib/validations/address';
import { Check, Plus } from 'lucide-react';
import { cn } from '@twicely/utils';

interface AddressSelectorProps {
  addresses: AddressData[];
  selectedAddressId: string | null;
  onSelect: (addressId: string) => void;
  onAddressAdded?: () => void;
}

export function AddressSelector({
  addresses,
  selectedAddressId,
  onSelect,
  onAddressAdded,
}: AddressSelectorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true);
    const result = await createAddress(data);
    setIsSubmitting(false);

    if (result.success && result.addressId) {
      setShowAddForm(false);
      onSelect(result.addressId);
      onAddressAdded?.();
    }

    return result;
  };

  if (addresses.length === 0 && !showAddForm) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">No saved addresses found.</p>
        <Button onClick={() => setShowAddForm(true)} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add New Address
        </Button>
      </div>
    );
  }

  if (showAddForm) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Add New Address</h3>
        <AddressForm
          onSubmit={handleAddSubmit}
          onCancel={() => setShowAddForm(false)}
          isSubmitting={isSubmitting}
          showSetDefault={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {addresses.map((address) => {
          const isSelected = address.id === selectedAddressId;
          return (
            <button
              key={address.id}
              type="button"
              onClick={() => onSelect(address.id)}
              className={cn(
                'relative w-full rounded-lg border p-4 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div className="space-y-1 pr-8">
                {(address.label || address.isDefault) && (
                  <div className="flex items-center gap-2">
                    {address.label && (
                      <span className="text-sm font-medium">{address.label}</span>
                    )}
                    {address.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                )}
                <p className="text-sm font-medium">{address.name}</p>
                <p className="text-sm text-muted-foreground">
                  {address.address1}
                  {address.address2 && <>, {address.address2}</>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {address.city}, {address.state} {address.zip}
                </p>
                {address.phone && (
                  <p className="text-sm text-muted-foreground">{address.phone}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setShowAddForm(true)}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add New Address
      </Button>
    </div>
  );
}
