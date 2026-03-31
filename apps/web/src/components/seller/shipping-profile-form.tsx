'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { Checkbox } from '@twicely/ui/checkbox';
import { createShippingProfile, updateShippingProfile } from '@/lib/actions/shipping-profiles';
import type { ShippingProfileData } from '@/lib/queries/shipping-profiles';
import type { CreateShippingProfileInput, UpdateShippingProfileInput } from '@/lib/validations/shipping-profile';
import { PackageDimensionsField, CombinedShippingField } from './shipping-profile-form-fields';
import type { ShippingFormData, CombinedShippingMode } from './shipping-profile-form-fields';

interface ShippingProfileFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: ShippingProfileData | null;
}

const INITIAL_FORM_DATA: ShippingFormData = {
  name: '',
  carrier: 'USPS',
  service: '',
  handlingTimeDays: 1,
  isDefault: false,
  weightOz: null,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  combinedShippingMode: 'NONE',
  flatCombinedCents: null,
  additionalItemCents: null,
  autoDiscountPercent: null,
  autoDiscountMinItems: 2,
};

export function ShippingProfileForm({ open, onOpenChange, profile }: ShippingProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setShippingFormData] = useState<ShippingFormData>(INITIAL_FORM_DATA);

  // Reset form when dialog opens/closes or profile changes
  useEffect(() => {
    if (open && profile) {
      setShippingFormData({
        name: profile.name,
        carrier: profile.carrier,
        service: profile.service || '',
        handlingTimeDays: profile.handlingTimeDays,
        isDefault: profile.isDefault,
        weightOz: profile.weightOz || null,
        lengthIn: profile.lengthIn || null,
        widthIn: profile.widthIn || null,
        heightIn: profile.heightIn || null,
        combinedShippingMode: profile.combinedShippingMode as CombinedShippingMode,
        flatCombinedCents: profile.flatCombinedCents || null,
        additionalItemCents: profile.additionalItemCents || null,
        autoDiscountPercent: profile.autoDiscountPercent || null,
        autoDiscountMinItems: profile.autoDiscountMinItems || 2,
      });
    } else if (open && !profile) {
      setShippingFormData(INITIAL_FORM_DATA);
    }
  }, [open, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      // Build submit data based on mode
      let submitData: Partial<CreateShippingProfileInput> | Partial<UpdateShippingProfileInput>;

      const baseData = {
        name: formData.name,
        carrier: formData.carrier as 'USPS' | 'UPS' | 'FedEx' | 'DHL',
        service: formData.service || undefined,
        handlingTimeDays: formData.handlingTimeDays,
        isDefault: formData.isDefault,
        weightOz: formData.weightOz || undefined,
        lengthIn: formData.lengthIn || undefined,
        widthIn: formData.widthIn || undefined,
        heightIn: formData.heightIn || undefined,
      };

      // Add mode-specific fields based on combined shipping mode
      if (formData.combinedShippingMode === 'FLAT') {
        submitData = {
          ...baseData,
          combinedShippingMode: 'FLAT' as const,
          flatCombinedCents: formData.flatCombinedCents!,
        };
      } else if (formData.combinedShippingMode === 'PER_ADDITIONAL') {
        submitData = {
          ...baseData,
          combinedShippingMode: 'PER_ADDITIONAL' as const,
          additionalItemCents: formData.additionalItemCents!,
        };
      } else if (formData.combinedShippingMode === 'AUTO_DISCOUNT') {
        submitData = {
          ...baseData,
          combinedShippingMode: 'AUTO_DISCOUNT' as const,
          autoDiscountPercent: formData.autoDiscountPercent!,
          autoDiscountMinItems: formData.autoDiscountMinItems || 2,
        };
      } else if (formData.combinedShippingMode === 'QUOTED') {
        submitData = {
          ...baseData,
          combinedShippingMode: 'QUOTED' as const,
        };
      } else {
        submitData = {
          ...baseData,
          combinedShippingMode: 'NONE' as const,
        };
      }

      const result = profile
        ? await updateShippingProfile({ ...submitData, id: profile.id } as UpdateShippingProfileInput)
        : await createShippingProfile(submitData as CreateShippingProfileInput);

      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setFormError(result.error || 'Failed to save shipping profile');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit' : 'Create'} Shipping Profile</DialogTitle>
          <DialogDescription>
            {profile
              ? 'Update your shipping profile settings.'
              : 'Create a new shipping profile for your listings.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Profile Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Profile Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setShippingFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard Apparel, Heavy Items"
              required
              maxLength={50}
            />
          </div>

          {/* Carrier and Service */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier *</Label>
              <Select
                value={formData.carrier}
                onValueChange={(value) => setShippingFormData({ ...formData, carrier: value })}
              >
                <SelectTrigger id="carrier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FEDEX">FedEx</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service (optional)</Label>
              <Input
                id="service"
                value={formData.service}
                onChange={(e) => setShippingFormData({ ...formData, service: e.target.value })}
                placeholder="e.g., Priority Mail, Ground"
                maxLength={50}
              />
            </div>
          </div>

          {/* Handling Time */}
          <div className="space-y-2">
            <Label htmlFor="handlingTimeDays">Handling Time (days) *</Label>
            <Input
              id="handlingTimeDays"
              type="number"
              min={1}
              max={30}
              value={formData.handlingTimeDays}
              onChange={(e) => setShippingFormData({ ...formData, handlingTimeDays: parseInt(e.target.value) || 1 })}
              required
            />
          </div>

          <PackageDimensionsField
            formData={formData}
            onFormDataChange={(updates) => setShippingFormData({ ...formData, ...updates })}
          />

          <CombinedShippingField
            formData={formData}
            onFormDataChange={(updates) => setShippingFormData({ ...formData, ...updates })}
          />

          {/* Set as Default */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={formData.isDefault}
              onCheckedChange={(checked) => setShippingFormData({ ...formData, isDefault: checked as boolean })}
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Set as default shipping profile
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : profile ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
