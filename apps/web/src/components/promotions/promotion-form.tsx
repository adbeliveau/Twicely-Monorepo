'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { createPromotion, updatePromotion, type CreatePromotionInput } from '@/lib/actions/promotions';
import type { PromotionRow } from '@/lib/queries/promotions';

type PromotionType = 'PERCENT_OFF' | 'AMOUNT_OFF' | 'FREE_SHIPPING' | 'BUNDLE_DISCOUNT';
type PromotionScope = 'STORE_WIDE' | 'CATEGORY' | 'SPECIFIC_LISTINGS';

interface PromotionFormProps {
  promotion?: PromotionRow;
  categories?: { id: string; name: string }[];
  listings?: { id: string; title: string }[];
}

function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 16);
}

export function PromotionForm({ promotion, categories = [], listings = [] }: PromotionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(promotion?.name ?? '');
  const [type, setType] = useState<PromotionType>((promotion?.type as PromotionType) ?? 'PERCENT_OFF');
  const [scope, setScope] = useState<PromotionScope>((promotion?.scope as PromotionScope) ?? 'STORE_WIDE');
  const [discountPercent, setDiscountPercent] = useState(promotion?.discountPercent?.toString() ?? '');
  const [discountAmount, setDiscountAmount] = useState(promotion?.discountAmountCents ? (promotion.discountAmountCents / 100).toString() : '');
  const [minimumOrder, setMinimumOrder] = useState(promotion?.minimumOrderCents ? (promotion.minimumOrderCents / 100).toString() : '');
  const [maxUsesTotal, setMaxUsesTotal] = useState(promotion?.maxUsesTotal?.toString() ?? '');
  const [maxUsesPerBuyer, setMaxUsesPerBuyer] = useState(promotion?.maxUsesPerBuyer?.toString() ?? '1');
  const [couponCode, setCouponCode] = useState(promotion?.couponCode ?? '');
  const [startsAt, setStartsAt] = useState(toDateInputValue(promotion?.startsAt ?? new Date()));
  const [endsAt, setEndsAt] = useState(toDateInputValue(promotion?.endsAt ?? null));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(promotion?.applicableCategoryIds ?? []);
  const [selectedListings, setSelectedListings] = useState<string[]>(promotion?.applicableListingIds ?? []);

  const showPercent = type === 'PERCENT_OFF' || type === 'BUNDLE_DISCOUNT';
  const showAmount = type === 'AMOUNT_OFF';
  const showCategories = scope === 'CATEGORY';
  const showListings = scope === 'SPECIFIC_LISTINGS';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: CreatePromotionInput = {
      name: name.trim(),
      type,
      scope,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      couponCode: couponCode.trim() || undefined,
      maxUsesPerBuyer: maxUsesPerBuyer ? parseInt(maxUsesPerBuyer, 10) : undefined,
      maxUsesTotal: maxUsesTotal ? parseInt(maxUsesTotal, 10) : undefined,
      minimumOrderCents: minimumOrder ? Math.round(parseFloat(minimumOrder) * 100) : undefined,
      applicableCategoryIds: showCategories ? selectedCategories : undefined,
      applicableListingIds: showListings ? selectedListings : undefined,
    };
    if (showPercent) input.discountPercent = parseInt(discountPercent, 10);
    if (showAmount) input.discountAmountCents = Math.round(parseFloat(discountAmount) * 100);

    startTransition(async () => {
      const result = promotion
        ? await updatePromotion(promotion.id, input)
        : await createPromotion(input);
      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }
      router.push('/my/selling/promotions');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Promotion Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Sale" required maxLength={100} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Discount Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PromotionType)}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT_OFF">Percentage Off</SelectItem>
                  <SelectItem value="AMOUNT_OFF">Fixed Amount Off</SelectItem>
                  <SelectItem value="FREE_SHIPPING">Free Shipping</SelectItem>
                  <SelectItem value="BUNDLE_DISCOUNT">Bundle Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Applies To</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as PromotionScope)}>
                <SelectTrigger id="scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STORE_WIDE">Entire Store</SelectItem>
                  <SelectItem value="CATEGORY">Specific Categories</SelectItem>
                  <SelectItem value="SPECIFIC_LISTINGS">Specific Listings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Discount Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {showPercent && (
            <div className="space-y-2">
              <Label htmlFor="discountPercent">Discount Percentage</Label>
              <Input id="discountPercent" type="number" min="1" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} placeholder="20" required />
            </div>
          )}
          {showAmount && (
            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount Amount ($)</Label>
              <Input id="discountAmount" type="number" min="0.01" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="10.00" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="minimumOrder">Minimum Order ($, optional)</Label>
            <Input id="minimumOrder" type="number" min="0" step="0.01" value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} placeholder="50.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="couponCode">Coupon Code (optional)</Label>
            <Input id="couponCode" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="SUMMER20" maxLength={20} className="font-mono uppercase" />
            <p className="text-xs text-muted-foreground">4-20 characters, letters, numbers, and hyphens only</p>
          </div>
        </CardContent>
      </Card>

      {showCategories && categories.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Select Categories</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button key={cat.id} type="button" variant={selectedCategories.includes(cat.id) ? 'default' : 'outline'} size="sm"
                  onClick={() => setSelectedCategories((prev) => prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id])}>
                  {cat.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showListings && listings.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Select Listings</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {listings.slice(0, 50).map((listing) => (
                <Button key={listing.id} type="button" variant={selectedListings.includes(listing.id) ? 'default' : 'outline'} size="sm"
                  onClick={() => setSelectedListings((prev) => prev.includes(listing.id) ? prev.filter((id) => id !== listing.id) : [...prev, listing.id])}>
                  {listing.title.slice(0, 30)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Schedule & Limits</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Start Date</Label>
              <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">End Date (optional)</Label>
              <Input id="endsAt" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxUsesTotal">Total Uses Limit (optional)</Label>
              <Input id="maxUsesTotal" type="number" min="1" value={maxUsesTotal} onChange={(e) => setMaxUsesTotal(e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUsesPerBuyer">Uses Per Buyer</Label>
              <Input id="maxUsesPerBuyer" type="number" min="1" value={maxUsesPerBuyer} onChange={(e) => setMaxUsesPerBuyer(e.target.value)} placeholder="1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : promotion ? 'Update Promotion' : 'Create Promotion'}</Button>
      </div>
    </form>
  );
}
