'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import { Separator } from '@twicely/ui/separator';

const CONDITIONS = [
  { value: 'NEW_WITH_TAGS', label: 'New with Tags' },
  { value: 'NEW_WITHOUT_TAGS', label: 'New without Tags' },
  { value: 'NEW_WITH_DEFECTS', label: 'New with Defects' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'VERY_GOOD', label: 'Very Good' },
  { value: 'GOOD', label: 'Good' },
  { value: 'ACCEPTABLE', label: 'Acceptable' },
];

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
}

interface SearchFiltersProps {
  categories: CategoryOption[];
  onClose?: () => void;
}

export function SearchFilters({ categories, onClose }: SearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category');
  const currentConditions =
    searchParams.get('condition')?.split(',').filter(Boolean) ?? [];
  const currentFreeShipping = searchParams.get('freeShipping') === 'true';

  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');

  function updateFilters(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    // Reset to page 1 when changing filters
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleCategoryClick(slug: string) {
    if (currentCategory === slug) {
      updateFilters({ category: null });
    } else {
      updateFilters({ category: slug });
    }
  }

  function handleConditionToggle(condition: string) {
    const newConditions = currentConditions.includes(condition)
      ? currentConditions.filter((c) => c !== condition)
      : [...currentConditions, condition];

    updateFilters({
      condition: newConditions.length > 0 ? newConditions.join(',') : null,
    });
  }

  function handleFreeShippingToggle() {
    updateFilters({
      freeShipping: currentFreeShipping ? null : 'true',
    });
  }

  function handlePriceApply() {
    // Convert dollars to cents for the filter
    const minCents = minPrice ? Math.round(parseFloat(minPrice) * 100) : null;
    const maxCents = maxPrice ? Math.round(parseFloat(maxPrice) * 100) : null;

    updateFilters({
      minPrice: minCents?.toString() ?? null,
      maxPrice: maxCents?.toString() ?? null,
    });
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    const sort = searchParams.get('sort');
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    router.push(`${pathname}?${params.toString()}`);
    setMinPrice('');
    setMaxPrice('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={clearAllFilters}>
          Clear all
        </Button>
      </div>

      <Separator />

      {/* Categories */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Category</h3>
          <div className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.slug)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                  currentCategory === cat.slug
                    ? 'bg-muted font-medium'
                    : ''
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-muted-foreground">
                  {cat.listingCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Condition */}
      <div className="space-y-3">
        <h3 className="font-medium">Condition</h3>
        <div className="space-y-2">
          {CONDITIONS.map((condition) => (
            <div key={condition.value} className="flex items-center space-x-2">
              <Checkbox
                id={`condition-${condition.value}`}
                checked={currentConditions.includes(condition.value)}
                onCheckedChange={() => handleConditionToggle(condition.value)}
              />
              <Label
                htmlFor={`condition-${condition.value}`}
                className="text-sm font-normal"
              >
                {condition.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range */}
      <div className="space-y-3">
        <h3 className="font-medium">Price Range</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="minPrice" className="sr-only">
              Minimum price
            </Label>
            <Input
              id="minPrice"
              type="number"
              placeholder="$ Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              min={0}
            />
          </div>
          <span className="text-muted-foreground">to</span>
          <div className="flex-1">
            <Label htmlFor="maxPrice" className="sr-only">
              Maximum price
            </Label>
            <Input
              id="maxPrice"
              type="number"
              placeholder="$ Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              min={0}
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePriceApply}
          className="w-full"
        >
          Apply Price
        </Button>
      </div>

      <Separator />

      {/* Free Shipping */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="freeShipping"
          checked={currentFreeShipping}
          onCheckedChange={handleFreeShippingToggle}
        />
        <Label htmlFor="freeShipping" className="text-sm font-normal">
          Free Shipping only
        </Label>
      </div>

      {/* Mobile apply button */}
      {onClose && (
        <>
          <Separator />
          <Button onClick={onClose} className="w-full">
            Apply Filters
          </Button>
        </>
      )}
    </div>
  );
}
