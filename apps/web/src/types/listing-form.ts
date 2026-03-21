import type { UploadedImage } from '@/types/upload';
import type { CategorySearchResult } from '@/lib/queries/category-search';

export type ListingCondition =
  | 'NEW_WITH_TAGS'
  | 'NEW_WITHOUT_TAGS'
  | 'NEW_WITH_DEFECTS'
  | 'LIKE_NEW'
  | 'VERY_GOOD'
  | 'GOOD'
  | 'ACCEPTABLE';

export interface ListingFormData {
  // Basic details
  title: string;
  description: string;
  category: CategorySearchResult | null;
  condition: ListingCondition | null;
  brand: string;
  tags: string[];
  images: UploadedImage[];
  quantity: number;

  // Pricing
  priceCents: number;
  originalPriceCents: number | null;
  cogsCents: number | null;

  // Offers
  allowOffers: boolean;
  autoAcceptOfferCents: number | null;
  autoDeclineOfferCents: number | null;

  // Shipping
  freeShipping: boolean;
  shippingCents: number;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;

  // Fulfillment (B3.4)
  fulfillmentType: 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL';
  localPickupRadiusMiles: number | null;
  localHandlingFlags: string[];

  // Video (optional, 1 per listing)
  videoUrl: string | null;
  videoThumbUrl: string | null;
  videoDurationSeconds: number | null;
}

export interface ListingFormErrors {
  title?: string;
  description?: string;
  category?: string;
  condition?: string;
  brand?: string;
  tags?: string;
  images?: string;
  quantity?: string;
  price?: string;
  originalPrice?: string;
  cogs?: string;
  autoAcceptOffer?: string;
  autoDeclineOffer?: string;
  shippingCents?: string;
  weight?: string;
  dimensions?: string;
  video?: string;
}

export const CONDITION_OPTIONS: {
  value: ListingCondition;
  label: string;
  description: string;
}[] = [
  {
    value: 'NEW_WITH_TAGS',
    label: 'New with tags',
    description: 'Brand new, unused, with original tags attached',
  },
  {
    value: 'NEW_WITHOUT_TAGS',
    label: 'New without tags',
    description: 'Brand new, unused, but tags have been removed',
  },
  {
    value: 'NEW_WITH_DEFECTS',
    label: 'New with defects',
    description: 'New but has minor defects (describe in listing)',
  },
  {
    value: 'LIKE_NEW',
    label: 'Like new',
    description: 'Worn once or twice, no visible signs of wear',
  },
  {
    value: 'VERY_GOOD',
    label: 'Very good',
    description: 'Gently used with minimal signs of wear',
  },
  {
    value: 'GOOD',
    label: 'Good',
    description: 'Used with some visible signs of wear',
  },
  {
    value: 'ACCEPTABLE',
    label: 'Acceptable',
    description: 'Well-worn but still functional',
  },
];

export const MAX_TAGS = 10;
export const MAX_TITLE_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MIN_PRICE_CENTS = 100; // $1.00
export const MAX_PRICE_CENTS = 10000000; // $100,000.00
export const MAX_QUANTITY = 999;

/**
 * Validate listing form data.
 * For ACTIVE listings, all required fields must be filled.
 * For DRAFT listings, minimal validation (just basic sanity checks).
 */
export function validateListingForm(
  data: ListingFormData,
  mode: 'ACTIVE' | 'DRAFT'
): ListingFormErrors {
  const errors: ListingFormErrors = {};

  // Title validation
  if (mode === 'ACTIVE') {
    if (!data.title.trim()) {
      errors.title = 'Title is required';
    } else if (data.title.length > MAX_TITLE_LENGTH) {
      errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or less`;
    }
  } else if (data.title.length > MAX_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or less`;
  }

  // Description validation
  if (mode === 'ACTIVE') {
    if (!data.description.trim()) {
      errors.description = 'Description is required';
    } else if (data.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`;
    }
  } else if (data.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`;
  }

  // Category validation
  if (mode === 'ACTIVE' && !data.category) {
    errors.category = 'Category is required';
  }

  // Condition validation
  if (mode === 'ACTIVE' && !data.condition) {
    errors.condition = 'Condition is required';
  }

  // Quantity validation
  if (data.quantity < 1) {
    errors.quantity = 'Quantity must be at least 1';
  } else if (data.quantity > MAX_QUANTITY) {
    errors.quantity = `Quantity must be ${MAX_QUANTITY} or less`;
  }

  // Price validation
  if (mode === 'ACTIVE') {
    if (data.priceCents < MIN_PRICE_CENTS) {
      errors.price = 'Price must be at least $1.00';
    } else if (data.priceCents > MAX_PRICE_CENTS) {
      errors.price = 'Price must be $100,000 or less';
    }
  } else if (data.priceCents > 0 && data.priceCents < MIN_PRICE_CENTS) {
    errors.price = 'Price must be at least $1.00';
  }

  // Original price validation
  if (data.originalPriceCents !== null) {
    if (data.originalPriceCents < data.priceCents) {
      errors.originalPrice = 'Original price must be higher than current price';
    } else if (data.originalPriceCents > MAX_PRICE_CENTS) {
      errors.originalPrice = 'Original price must be $100,000 or less';
    }
  }

  // Offer validation
  if (data.allowOffers) {
    if (
      data.autoAcceptOfferCents !== null &&
      data.autoDeclineOfferCents !== null &&
      data.autoAcceptOfferCents <= data.autoDeclineOfferCents
    ) {
      errors.autoAcceptOffer = 'Auto-accept must be higher than auto-decline';
    }
    if (
      data.autoAcceptOfferCents !== null &&
      data.autoAcceptOfferCents > data.priceCents
    ) {
      errors.autoAcceptOffer = 'Auto-accept cannot be higher than listing price';
    }
  }

  // Tags validation
  if (data.tags.length > MAX_TAGS) {
    errors.tags = `Maximum ${MAX_TAGS} tags allowed`;
  }

  // Images validation
  if (mode === 'ACTIVE' && data.images.length === 0) {
    errors.images = 'At least one image is required';
  }

  return errors;
}

/**
 * Check if there are any validation errors.
 */
export function hasErrors(errors: ListingFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
