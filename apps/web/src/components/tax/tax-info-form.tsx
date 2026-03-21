'use client';

import { useState, useTransition } from 'react';
import { saveTaxInfoAction } from '@/lib/actions/tax-info';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';

interface ExistingTaxInfo {
  taxIdType: string | null;
  maskedTaxId: string | null;
  legalName: string | null;
  businessName: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
}

interface TaxInfoFormProps {
  existingTaxInfo: ExistingTaxInfo | null;
}

export function TaxInfoForm({ existingTaxInfo }: TaxInfoFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(!existingTaxInfo);
  const [taxIdType, setTaxIdType] = useState<string>(
    existingTaxInfo?.taxIdType ?? 'SSN'
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const input = {
      taxIdType: formData.get('taxIdType') as string,
      taxId: formData.get('taxId') as string,
      legalName: formData.get('legalName') as string,
      businessName: (formData.get('businessName') as string) || undefined,
      address1: formData.get('address1') as string,
      city: formData.get('city') as string,
      state: formData.get('state') as string,
      zip: formData.get('zip') as string,
      country: 'US',
    };

    startTransition(async () => {
      const result = await saveTaxInfoAction(input);
      if (result.success) {
        setSuccess(true);
        setIsEditing(false);
      } else {
        setError(result.error ?? 'Failed to save tax information');
      }
    });
  }

  if (existingTaxInfo && !isEditing) {
    return (
      <div className="space-y-4">
        {success && (
          <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">
            Tax information saved successfully.
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Tax ID type</dt>
            <dd className="font-medium">{existingTaxInfo.taxIdType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tax ID</dt>
            <dd className="font-medium font-mono">
              {existingTaxInfo.maskedTaxId ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Legal name</dt>
            <dd className="font-medium">{existingTaxInfo.legalName}</dd>
          </div>
          {existingTaxInfo.businessName && (
            <div>
              <dt className="text-muted-foreground">Business name</dt>
              <dd className="font-medium">{existingTaxInfo.businessName}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="font-medium">
              {existingTaxInfo.address1}, {existingTaxInfo.city},{' '}
              {existingTaxInfo.state} {existingTaxInfo.zip}
            </dd>
          </div>
        </dl>
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          Update tax information
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="taxIdType">Tax ID type</Label>
          <Select
            name="taxIdType"
            value={taxIdType}
            onValueChange={setTaxIdType}
          >
            <SelectTrigger id="taxIdType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SSN">SSN (Social Security Number)</SelectItem>
              <SelectItem value="EIN">EIN (Employer ID Number)</SelectItem>
              <SelectItem value="ITIN">ITIN (Individual Taxpayer ID)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="taxId">
            {taxIdType === 'EIN' ? 'EIN' : taxIdType === 'ITIN' ? 'ITIN' : 'SSN'}{' '}
            <span className="text-muted-foreground text-xs">(digits only, no dashes)</span>
          </Label>
          <Input
            id="taxId"
            name="taxId"
            type="password"
            autoComplete="off"
            placeholder="9 digits"
            maxLength={11}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="legalName">Legal name</Label>
          <Input
            id="legalName"
            name="legalName"
            defaultValue={existingTaxInfo?.legalName ?? ''}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessName">
            Business name{' '}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={existingTaxInfo?.businessName ?? ''}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="address1">Address</Label>
          <Input
            id="address1"
            name="address1"
            defaultValue={existingTaxInfo?.address1 ?? ''}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={existingTaxInfo?.city ?? ''}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              name="state"
              maxLength={2}
              placeholder="CA"
              defaultValue={existingTaxInfo?.state ?? ''}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP code</Label>
            <Input
              id="zip"
              name="zip"
              maxLength={10}
              placeholder="90210"
              defaultValue={existingTaxInfo?.zip ?? ''}
              required
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : existingTaxInfo ? 'Update tax information' : 'Save tax information'}
        </Button>
        {existingTaxInfo && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
