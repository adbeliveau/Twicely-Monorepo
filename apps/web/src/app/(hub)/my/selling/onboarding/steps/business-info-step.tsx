'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { Loader2 } from 'lucide-react';
import { submitBusinessInfoAction, updateBusinessInfoAction } from '@/lib/actions/seller-onboarding';
import type { BusinessInfoInput } from '@/lib/validations/seller-onboarding';
import type { BusinessInfoRecord } from '@/lib/queries/business-info';

interface BusinessInfoStepProps {
  existing: BusinessInfoRecord | null;
  onComplete: () => void;
}

type BusinessType = 'SOLE_PROPRIETOR' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP';

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SOLE_PROPRIETOR: 'Sole Proprietor',
  LLC: 'LLC',
  CORPORATION: 'Corporation',
  PARTNERSHIP: 'Partnership',
};

export function BusinessInfoStep({ existing, onComplete }: BusinessInfoStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BusinessInfoInput>({
    businessName: existing?.businessName ?? '',
    businessType: (existing?.businessType as BusinessType) ?? 'SOLE_PROPRIETOR',
    ein: existing?.ein ?? '',
    address1: existing?.address1 ?? '',
    address2: existing?.address2 ?? '',
    city: existing?.city ?? '',
    state: (existing?.state ?? 'AL') as BusinessInfoInput['state'],
    zip: existing?.zip ?? '',
    country: existing?.country ?? 'US',
    phone: existing?.phone ?? '',
    website: existing?.website ?? '',
  });

  function handleChange(field: keyof BusinessInfoInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const action = existing ? updateBusinessInfoAction : submitBusinessInfoAction;
    const result = await action(form);

    setIsLoading(false);
    if (result.success) {
      onComplete();
    } else {
      setError(result.error ?? 'Something went wrong');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>
          This information is required to open a Twicely store. It is used for tax reporting and
          identity verification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="businessName">Legal Business Name</Label>
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={form.businessType}
                onValueChange={(v) => handleChange('businessType', v)}
              >
                <SelectTrigger id="businessType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {BUSINESS_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ein">EIN (optional)</Label>
              <Input
                id="ein"
                placeholder="12-3456789"
                value={form.ein ?? ''}
                onChange={(e) => handleChange('ein', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address1">Address</Label>
              <Input
                id="address1"
                placeholder="Street address"
                value={form.address1}
                onChange={(e) => handleChange('address1', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address2">Address line 2 (optional)</Label>
              <Input
                id="address2"
                placeholder="Suite, unit, etc."
                value={form.address2 ?? ''}
                onChange={(e) => handleChange('address2', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="e.g. CA"
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value as BusinessInfoInput['state'])}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="12345"
                value={form.zip}
                onChange={(e) => handleChange('zip', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Business Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="website">Business Website (optional)</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={form.website ?? ''}
                onChange={(e) => handleChange('website', e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? 'Update Business Info' : 'Save & Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
