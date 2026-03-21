'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { Checkbox } from '@twicely/ui/checkbox';
import { Label } from '@twicely/ui/label';
import { Loader2 } from 'lucide-react';
import { addressSchema, US_STATES, type AddressFormData } from '@/lib/validations/address';
import type { AddressData } from '@/lib/queries/address';

interface AddressFormProps {
  initialData?: Partial<AddressData>;
  onSubmit: (data: AddressFormData) => Promise<{ success: boolean; errors?: Record<string, string> }>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  showSetDefault?: boolean;
}

export function AddressForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save Address',
  showSetDefault = true,
}: AddressFormProps) {
  const [formData, setFormData] = useState<AddressFormData>({
    label: initialData?.label ?? '',
    name: initialData?.name ?? '',
    address1: initialData?.address1 ?? '',
    address2: initialData?.address2 ?? '',
    city: initialData?.city ?? '',
    state: initialData?.state ?? '',
    zip: initialData?.zip ?? '',
    country: initialData?.country ?? 'US',
    phone: initialData?.phone ?? '',
    isDefault: initialData?.isDefault ?? false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation first (instant feedback)
    const parsed = addressSchema.safeParse(formData);
    if (!parsed.success) {
      const clientErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field && typeof field === 'string') clientErrors[field] = issue.message;
      }
      setErrors(clientErrors);
      return;
    }

    // Server validation (defense in depth)
    const result = await onSubmit(formData);
    if (!result.success && result.errors) {
      setErrors(result.errors);
    }
  }

  function handleChange(field: keyof AddressFormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Label (optional) */}
      <div>
        <Label htmlFor="label">Label (optional)</Label>
        <Input
          id="label"
          placeholder="e.g., Home, Work"
          value={formData.label}
          onChange={(e) => handleChange('label', e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          disabled={isSubmitting}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
      </div>

      {/* Address Line 1 */}
      <div>
        <Label htmlFor="address1">Street Address *</Label>
        <Input
          id="address1"
          value={formData.address1}
          onChange={(e) => handleChange('address1', e.target.value)}
          disabled={isSubmitting}
          className={errors.address1 ? 'border-red-500' : ''}
        />
        {errors.address1 && <p className="text-sm text-red-600 mt-1">{errors.address1}</p>}
      </div>

      {/* Address Line 2 */}
      <div>
        <Label htmlFor="address2">Apt, Suite, Unit (optional)</Label>
        <Input
          id="address2"
          value={formData.address2}
          onChange={(e) => handleChange('address2', e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* City, State, ZIP */}
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            disabled={isSubmitting}
            className={errors.city ? 'border-red-500' : ''}
          />
          {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city}</p>}
        </div>

        <div className="col-span-2">
          <Label htmlFor="state">State *</Label>
          <Select
            value={formData.state}
            onValueChange={(value) => handleChange('state', value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className={errors.state ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.state && <p className="text-sm text-red-600 mt-1">{errors.state}</p>}
        </div>

        <div className="col-span-2">
          <Label htmlFor="zip">ZIP Code *</Label>
          <Input
            id="zip"
            value={formData.zip}
            onChange={(e) => handleChange('zip', e.target.value)}
            disabled={isSubmitting}
            className={errors.zip ? 'border-red-500' : ''}
          />
          {errors.zip && <p className="text-sm text-red-600 mt-1">{errors.zip}</p>}
        </div>
      </div>

      {/* Country (US only, disabled) */}
      <div>
        <Label htmlFor="country">Country</Label>
        <Input id="country" value="United States" disabled />
      </div>

      {/* Phone (optional) */}
      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* Set as Default */}
      {showSetDefault && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isDefault"
            checked={formData.isDefault}
            onCheckedChange={(checked) => handleChange('isDefault', checked === true)}
            disabled={isSubmitting}
          />
          <Label htmlFor="isDefault" className="font-normal cursor-pointer">
            Set as default shipping address
          </Label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
