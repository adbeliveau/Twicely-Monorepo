'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';

const CONDITION_LABELS: Record<string, string> = {
  NEW_WITH_TAGS: 'New with Tags',
  NEW_WITHOUT_TAGS: 'New without Tags',
  NEW_WITH_DEFECTS: 'New with Defects',
  LIKE_NEW: 'Like New',
  VERY_GOOD: 'Very Good',
  GOOD: 'Good',
  ACCEPTABLE: 'Acceptable',
};

interface ActiveFiltersProps {
  categoryName?: string;
}

export function ActiveFilters({ categoryName }: ActiveFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get('category');
  const conditions = searchParams.get('condition')?.split(',').filter(Boolean) ?? [];
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const freeShipping = searchParams.get('freeShipping') === 'true';
  const brand = searchParams.get('brand');

  const hasActiveFilters =
    category || conditions.length > 0 || minPrice || maxPrice || freeShipping || brand;

  if (!hasActiveFilters) {
    return null;
  }

  function removeFilter(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (key === 'condition' && value) {
      const currentConditions = params.get('condition')?.split(',') ?? [];
      const newConditions = currentConditions.filter((c) => c !== value);
      if (newConditions.length > 0) {
        params.set('condition', newConditions.join(','));
      } else {
        params.delete('condition');
      }
    } else {
      params.delete(key);
    }

    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    const sort = searchParams.get('sort');
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filters:</span>

      {category && categoryName && (
        <FilterTag
          label={`Category: ${categoryName}`}
          onRemove={() => removeFilter('category')}
        />
      )}

      {conditions.map((condition) => (
        <FilterTag
          key={condition}
          label={CONDITION_LABELS[condition] ?? condition}
          onRemove={() => removeFilter('condition', condition)}
        />
      ))}

      {minPrice && (
        <FilterTag
          label={`Min: ${formatPrice(parseInt(minPrice, 10))}`}
          onRemove={() => removeFilter('minPrice')}
        />
      )}

      {maxPrice && (
        <FilterTag
          label={`Max: ${formatPrice(parseInt(maxPrice, 10))}`}
          onRemove={() => removeFilter('maxPrice')}
        />
      )}

      {freeShipping && (
        <FilterTag
          label="Free Shipping"
          onRemove={() => removeFilter('freeShipping')}
        />
      )}

      {brand && (
        <FilterTag
          label={`Brand: ${brand}`}
          onRemove={() => removeFilter('brand')}
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={clearAllFilters}
        className="text-muted-foreground hover:text-foreground"
      >
        Clear all
      </Button>
    </div>
  );
}

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-sm">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
