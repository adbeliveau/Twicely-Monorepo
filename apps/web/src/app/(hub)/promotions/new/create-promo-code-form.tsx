'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { adminCreatePlatformPromoCode } from '@/lib/actions/admin-promotions';

const SCOPE_OPTIONS = [
  { value: 'store', label: 'Store' },
  { value: 'lister', label: 'Crosslister' },
  { value: 'automation', label: 'Automation' },
  { value: 'finance', label: 'Finance' },
] as const;

export function CreatePromoCodeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [scopeProductTypes, setScopeProductTypes] = useState<string[]>([]);
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  function toggleScope(value: string) {
    setScopeProductTypes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const discountNum = parseInt(discountValue, 10);
    if (isNaN(discountNum) || discountNum < 1) {
      setError('Discount value must be a positive number');
      return;
    }

    const durationNum = parseInt(durationMonths, 10);
    if (isNaN(durationNum) || durationNum < 1 || durationNum > 12) {
      setError('Duration must be between 1 and 12 months');
      return;
    }

    const usageLimitNum = usageLimit ? parseInt(usageLimit, 10) : undefined;
    const expiresAtVal = expiresAt ? new Date(expiresAt).toISOString() : undefined;

    startTransition(async () => {
      const result = await adminCreatePlatformPromoCode({
        code,
        discountType,
        discountValue: discountNum,
        durationMonths: durationNum,
        scopeProductTypes: scopeProductTypes.length > 0
          ? (scopeProductTypes as ('store' | 'lister' | 'automation' | 'finance')[])
          : undefined,
        usageLimit: usageLimitNum,
        expiresAt: expiresAtVal,
      });

      if (result.success) {
        router.push('/promotions');
      } else {
        setError(result.error ?? 'An error occurred');
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create Platform Promo Code</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new platform-wide promo code for subscription discounts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <Label htmlFor="code">Code (4-20 characters, auto-uppercased)</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH50"
            minLength={4}
            maxLength={20}
            pattern="[A-Z0-9-]+"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Discount Type</Label>
          <RadioGroup
            value={discountType}
            onValueChange={(v) => setDiscountType(v as 'PERCENTAGE' | 'FIXED')}
            className="flex gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="PERCENTAGE" id="new-type-pct" />
              <Label htmlFor="new-type-pct">Percentage (BPS, e.g. 5000 = 50%)</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="FIXED" id="new-type-fixed" />
              <Label htmlFor="new-type-fixed">Fixed (cents, e.g. 1000 = $10.00)</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-discountValue">
              {discountType === 'PERCENTAGE' ? 'Discount Value (BPS)' : 'Discount Value (cents)'}
            </Label>
            <Input
              id="new-discountValue"
              type="number"
              min={1}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'PERCENTAGE' ? '5000' : '1000'}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-durationMonths">Duration (months, 1-12)</Label>
            <Input
              id="new-durationMonths"
              type="number"
              min={1}
              max={12}
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Scope (leave empty to apply to all products)</Label>
          <div className="grid grid-cols-2 gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`new-scope-${opt.value}`}
                  checked={scopeProductTypes.includes(opt.value)}
                  onCheckedChange={() => toggleScope(opt.value)}
                />
                <Label htmlFor={`new-scope-${opt.value}`} className="cursor-pointer font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-usageLimit">Usage Limit (optional)</Label>
            <Input
              id="new-usageLimit"
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-expiresAt">Expires At (optional)</Label>
            <Input
              id="new-expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Promo Code'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/promotions')}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
