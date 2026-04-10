import type { variationType, variationValue, listingChild, variantReservation } from '@twicely/db/schema';

export type VariationType = typeof variationType.$inferSelect;
export type VariationValue = typeof variationValue.$inferSelect;
export type ListingChild = typeof listingChild.$inferSelect;
export type VariantReservation = typeof variantReservation.$inferSelect;

export interface CreateVariationTypeInput {
  key: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface UpdateVariationTypeInput {
  label?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}

export interface CreateVariationValueInput {
  variationTypeId: string;
  value: string;
  scope: 'PLATFORM' | 'CATEGORY' | 'SELLER';
  categoryId?: string;
  sellerId?: string;
  colorHex?: string;
  imageUrl?: string;
}

export interface CreateListingChildInput {
  parentListingId: string;
  variationCombination: Record<string, string>;
  sku?: string;
  priceCents: number;
  quantity: number;
  compareAtPriceCents?: number;
  costCents?: number;
  weightOz?: number;
  barcode?: string;
  isDefault?: boolean;
}

export interface UpdateListingChildInput {
  priceCents?: number;
  quantity?: number;
  compareAtPriceCents?: number;
  costCents?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface SetVariationsInput {
  dimensions: Array<{
    variationTypeId: string;
    values: Array<{
      variationValueId?: string;
      customValue?: string;
      displayValue: string;
    }>;
  }>;
}

export interface VariationMatrix {
  dimensions: Array<{
    variationTypeId: string;
    typeName: string;
    values: Array<{
      id: string;
      displayValue: string;
      variationValueId?: string | null;
    }>;
  }>;
  children: ListingChild[];
}

export interface ReserveStockResult {
  success: boolean;
  reservationId?: string;
  error?: string;
}
