/**
 * Combined Shipping Calculator (B3.3)
 * Modes: NONE, FLAT, PER_ADDITIONAL, AUTO_DISCOUNT, QUOTED (D2.2 placeholder)
 */

export type CombinedShippingMode = 'NONE' | 'FLAT' | 'PER_ADDITIONAL' | 'AUTO_DISCOUNT' | 'QUOTED';

export interface CombinedShippingItem {
  listingId: string;
  shippingCents: number;
  quantity: number;
}

export interface CombinedShippingInput {
  mode: CombinedShippingMode;
  items: CombinedShippingItem[];
  flatCombinedCents?: number | null;
  additionalItemCents?: number | null;
  autoDiscountPercent?: number | null;
  autoDiscountMinItems?: number | null;
}

export interface CombinedShippingResult {
  totalShippingCents: number;
  savingsCents: number;
  mode: CombinedShippingMode;
  itemBreakdown: Array<{
    listingId: string;
    originalCents: number;
    adjustedCents: number;
    quantity: number;
  }>;
}

/** Calculates combined shipping for items from the same seller. */
export function calculateCombinedShipping(
  input: CombinedShippingInput
): CombinedShippingResult {
  const { mode, items } = input;

  // Calculate individual shipping total (baseline for savings calculation)
  const individualTotal = items.reduce(
    (sum, item) => sum + item.shippingCents * item.quantity,
    0
  );

  // Total quantity of items
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Early return for single item or empty cart - no combination possible
  if (totalQuantity <= 1 || items.length === 0) {
    return {
      totalShippingCents: individualTotal,
      savingsCents: 0,
      mode,
      itemBreakdown: items.map((item) => ({
        listingId: item.listingId,
        originalCents: item.shippingCents * item.quantity,
        adjustedCents: item.shippingCents * item.quantity,
        quantity: item.quantity,
      })),
    };
  }

  switch (mode) {
    case 'NONE':
      return calculateNone(items, individualTotal);

    case 'FLAT':
      return calculateFlat(items, individualTotal, input.flatCombinedCents);

    case 'PER_ADDITIONAL':
      return calculatePerAdditional(
        items,
        individualTotal,
        input.additionalItemCents
      );

    case 'AUTO_DISCOUNT':
      return calculateAutoDiscount(
        items,
        individualTotal,
        input.autoDiscountPercent,
        input.autoDiscountMinItems
      );

    case 'QUOTED':
      // QUOTED mode: at order creation time, charge MAX shipping (sum of individual rates).
      // The actual combined quote will be provided by the seller post-purchase.
      // At checkout, we return the individual total as the auth hold ceiling.
      return {
        totalShippingCents: individualTotal,
        savingsCents: 0,
        mode: 'QUOTED',
        itemBreakdown: items.map((item) => ({
          listingId: item.listingId,
          originalCents: item.shippingCents * item.quantity,
          adjustedCents: item.shippingCents * item.quantity,
          quantity: item.quantity,
        })),
      };

    default: {
      // Exhaustive check - assigning to variable ensures compile-time error if case is missing
      mode satisfies never;
      return calculateNone(items, individualTotal);
    }
  }
}

/** Mode: NONE - No combination, each item pays individual shipping */
function calculateNone(
  items: CombinedShippingItem[],
  individualTotal: number
): CombinedShippingResult {
  return {
    totalShippingCents: individualTotal,
    savingsCents: 0,
    mode: 'NONE',
    itemBreakdown: items.map((item) => ({
      listingId: item.listingId,
      originalCents: item.shippingCents * item.quantity,
      adjustedCents: item.shippingCents * item.quantity,
      quantity: item.quantity,
    })),
  };
}

/** Mode: FLAT - Single flat rate for all items combined */
function calculateFlat(
  items: CombinedShippingItem[],
  individualTotal: number,
  flatCombinedCents: number | null | undefined
): CombinedShippingResult {
  // If flat rate not configured, fall back to individual
  if (flatCombinedCents == null || flatCombinedCents < 0) {
    return calculateNone(items, individualTotal);
  }

  const totalShippingCents = flatCombinedCents;
  const savingsCents = Math.max(0, individualTotal - totalShippingCents);

  // Distribute flat rate proportionally across items for breakdown
  const breakdown = distributeProportionally(items, totalShippingCents);

  return {
    totalShippingCents,
    savingsCents,
    mode: 'FLAT',
    itemBreakdown: breakdown,
  };
}

/** Mode: PER_ADDITIONAL - First item full price, additional items at reduced rate (sorted by cost desc) */
function calculatePerAdditional(
  items: CombinedShippingItem[],
  individualTotal: number,
  additionalItemCents: number | null | undefined
): CombinedShippingResult {
  // If additional rate not configured, fall back to individual
  if (additionalItemCents == null || additionalItemCents < 0) {
    return calculateNone(items, individualTotal);
  }

  // Sort by shipping cost descending to have most expensive first
  const sortedItems = [...items].sort(
    (a, b) => b.shippingCents - a.shippingCents
  );

  const breakdown: CombinedShippingResult['itemBreakdown'] = [];
  let totalShippingCents = 0;
  let isFirstItem = true;

  for (const item of sortedItems) {
    const originalCents = item.shippingCents * item.quantity;

    if (isFirstItem) {
      // First item (or first unit of first item) pays full shipping
      // Additional units of the same item pay the additional rate
      const firstUnitCents = item.shippingCents;
      const additionalUnitsCents = additionalItemCents * (item.quantity - 1);
      const adjustedCents = firstUnitCents + additionalUnitsCents;

      breakdown.push({
        listingId: item.listingId,
        originalCents,
        adjustedCents,
        quantity: item.quantity,
      });
      totalShippingCents += adjustedCents;
      isFirstItem = false;
    } else {
      // All units pay additional rate
      const adjustedCents = additionalItemCents * item.quantity;
      breakdown.push({
        listingId: item.listingId,
        originalCents,
        adjustedCents,
        quantity: item.quantity,
      });
      totalShippingCents += adjustedCents;
    }
  }

  const savingsCents = Math.max(0, individualTotal - totalShippingCents);

  return {
    totalShippingCents,
    savingsCents,
    mode: 'PER_ADDITIONAL',
    itemBreakdown: breakdown,
  };
}

/** Mode: AUTO_DISCOUNT - Percentage off total shipping when min items reached */
function calculateAutoDiscount(
  items: CombinedShippingItem[],
  individualTotal: number,
  autoDiscountPercent: number | null | undefined,
  autoDiscountMinItems: number | null | undefined
): CombinedShippingResult {
  const minItems = autoDiscountMinItems ?? 2;
  const discountPercent = autoDiscountPercent ?? 0;

  // Calculate total quantity
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // If minimum not reached or discount not configured, fall back to individual
  if (totalQuantity < minItems || discountPercent <= 0) {
    return calculateNone(items, individualTotal);
  }

  // Clamp discount to valid range (10-75% per spec)
  const clampedPercent = Math.min(75, Math.max(10, discountPercent));
  const discountMultiplier = 1 - clampedPercent / 100;

  const totalShippingCents = Math.round(individualTotal * discountMultiplier);
  const savingsCents = individualTotal - totalShippingCents;

  // Distribute discounted total proportionally across items
  const breakdown = distributeProportionally(items, totalShippingCents);

  return {
    totalShippingCents,
    savingsCents,
    mode: 'AUTO_DISCOUNT',
    itemBreakdown: breakdown,
  };
}

/** Distributes total proportionally across items based on original shipping costs */
function distributeProportionally(
  items: CombinedShippingItem[],
  totalToDistribute: number
): CombinedShippingResult['itemBreakdown'] {
  const individualTotal = items.reduce(
    (sum, item) => sum + item.shippingCents * item.quantity,
    0
  );

  if (individualTotal === 0) {
    return items.map((item) => ({
      listingId: item.listingId,
      originalCents: 0,
      adjustedCents: 0,
      quantity: item.quantity,
    }));
  }

  const breakdown: CombinedShippingResult['itemBreakdown'] = [];
  let distributedTotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const originalCents = item.shippingCents * item.quantity;
    const proportion = originalCents / individualTotal;

    let adjustedCents: number;
    if (i === items.length - 1) {
      // Last item gets remainder to ensure exact total
      adjustedCents = totalToDistribute - distributedTotal;
    } else {
      adjustedCents = Math.round(totalToDistribute * proportion);
    }

    distributedTotal += adjustedCents;
    breakdown.push({
      listingId: item.listingId,
      originalCents,
      adjustedCents,
      quantity: item.quantity,
    });
  }

  return breakdown;
}
