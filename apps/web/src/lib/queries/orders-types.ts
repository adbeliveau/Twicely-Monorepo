/**
 * Order query types — shared across buyer, seller, and detail queries
 */

export interface BuyerOrderSummary {
  orderId: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  firstItemThumbnail: string | null;
  firstItemTitle: string;
  itemCount: number;
}

export interface SellerOrderSummary extends BuyerOrderSummary {
  buyerName: string;
  expectedShipByAt: Date | null;
  isLateShipment: boolean;
}

export interface OrderDetailData {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    itemSubtotalCents: number;
    shippingCents: number;
    taxCents: number;
    discountCents: number;
    // v3.2: Fee breakdown fields for seller payout clarity
    tfAmountCents: number | null;
    stripeFeesCents: number | null;
    createdAt: Date;
    paidAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    trackingNumber: string | null;
    carrierCode: string | null;
    shippingAddressJson: unknown;
    buyerNote: string | null;
    isGift: boolean;
    giftMessage: string | null;
    buyerId: string;
    sellerId: string;
    isLateShipment: boolean;
    expectedShipByAt: Date | null;
    cancelReason: string | null;
    cancelInitiator: string | null;
    // B3.4: Local pickup fields
    isLocalPickup: boolean;
    localTransactionId: string | null;
    // B3.5: Authentication fields
    authenticationOffered: boolean;
    authenticationDeclined: boolean;
    authenticationDeclinedAt: Date | null;
    authenticationRequestId: string | null;
  };
  items: Array<{
    id: string;
    listingId: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
    imageUrl: string | null;
  }>;
  shipment: {
    id: string;
    tracking: string | null;
    carrier: string | null;
    status: string;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  } | null;
  buyer: {
    name: string;
  };
  seller: {
    name: string;
    storeName: string | null;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
