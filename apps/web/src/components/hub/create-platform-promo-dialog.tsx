'use client';

import { useState, useTransition } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { createPlatformPromoCode } from '@/lib/actions/promo-codes-platform';

const SCOPE_OPTIONS = [
  { value: 'store', label: 'Store' },
  { value: 'lister', label: 'Crosslister' },
  { value: 'automation', label: 'Automation' },
  { value: 'finance', label: 'Finance' },
] as const;

export function CreatePlatformPromoDialog() {
  const [open, setOpen] = useState(false);
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
    if (isNaN(discountNum)) {
      setError('Discount value must be a number');
      return;
    }

    const durationNum = parseInt(durationMonths, 10);
    const usageLimitNum = usageLimit ? parseInt(usageLimit, 10) : undefined;
    const expiresAtVal = expiresAt ? new Date(expiresAt).toISOString() : undefined;

    startTransition(async () => {
      const result = await createPlatformPromoCode({
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
        setOpen(false);
      } else {
        setError(result.error ?? 'An error occurred');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Platform Code</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Platform Promo Code</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH50"
              maxLength={20}
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
                <RadioGroupItem value="PERCENTAGE" id="plat-type-pct" />
                <Label htmlFor="plat-type-pct">Percentage (BPS)</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="FIXED" id="plat-type-fixed" />
                <Label htmlFor="plat-type-fixed">Fixed (cents)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="plat-discountValue">
                {discountType === 'PERCENTAGE' ? 'Discount (BPS)' : 'Discount (cents)'}
              </Label>
              <Input
                id="plat-discountValue"
                type="number"
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'PERCENTAGE' ? '5000' : '1000'}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plat-durationMonths">Duration (months)</Label>
              <Input
                id="plat-durationMonths"
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
            <Label>Applies to (leave empty for all)</Label>
            <div className="grid grid-cols-2 gap-2">
              {SCOPE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`plat-scope-${opt.value}`}
                    checked={scopeProductTypes.includes(opt.value)}
                    onCheckedChange={() => toggleScope(opt.value)}
                  />
                  <Label htmlFor={`plat-scope-${opt.value}`} className="cursor-pointer font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="plat-usageLimit">Usage Limit (optional)</Label>
              <Input
                id="plat-usageLimit"
                type="number"
                min={1}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plat-expiresAt">Expires At (optional)</Label>
              <Input
                id="plat-expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Code'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
