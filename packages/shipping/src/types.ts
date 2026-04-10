/**
 * @twicely/shipping — Shared types
 *
 * All monetary values are integer cents. Shippo returns floats;
 * conversion happens at the provider boundary via Math.round(parseFloat(amount) * 100).
 */

// ── Address ────────────────────────────────────────────────────────────
export interface AddressInput {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ValidatedAddress extends AddressInput {
  isValid: boolean;
  messages: string[];
  suggestedAddress?: AddressInput;
}

// ── Parcel ─────────────────────────────────────────────────────────────
export interface ParcelInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  packageType?: string;
}

export interface ShipmentDimensions {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
}

// ── Rate ───────────────────────────────────────────────────────────────
export type RateTag = 'CHEAPEST' | 'FASTEST' | 'BEST_VALUE';

export interface RateRequest {
  fromAddress: AddressInput;
  toAddress: AddressInput;
  parcel: ParcelInput;
  carriers?: string[];
  serviceLevel?: string;
  includeInsurance?: boolean;
  insuredValueCents?: number;
}

export interface RateResult {
  carrier: string;
  carrierCode: string;
  service: string;
  serviceCode: string;
  rateCents: number;
  surchargesCents: number;
  totalCents: number;
  currency: string;
  etaDays: number | null;
  etaBusinessDays: number | null;
  guaranteedDelivery: boolean;
  providerRateId: string;
  carrierAccountId?: string;
  insuranceAvailable: boolean;
  insuranceCostCents?: number;
  retailRateCents?: number;
  savingsPercent?: number;
  tag?: RateTag;
}

export interface RateResponse {
  success: boolean;
  rates: RateResult[];
  sessionId: string;
  error?: string;
}

// ── Label ──────────────────────────────────────────────────────────────
export interface LabelRequest {
  orderId: string;
  sellerId: string;
  shipmentId: string;
  providerRateId: string;
  parcel: ParcelInput;
  fromAddress: AddressInput;
  toAddress: AddressInput;
  includeInsurance?: boolean;
  insuredValueCents?: number;
  signatureType?: string;
  labelFormat?: string;
}

export interface PurchaseOptions {
  includeInsurance: boolean;
  insuredValueCents: number;
  signatureType?: string;
  labelFormat: string;
}

export interface LabelResult {
  providerLabelId: string;
  providerRateId: string;
  providerShipmentId?: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  carrierCode: string;
  service: string;
  serviceCode: string;
  rateCents: number;
  surchargesCents: number;
  insuranceCostCents: number;
  totalCostCents: number;
  retailRateCents?: number;
  carrierAccountId?: string;
  labelFormat: string;
}

export interface PurchasedLabel {
  id: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
  sellerPaidCents: number;
  totalCostCents: number;
  labelFormat: string;
}

export interface LabelResponse {
  success: boolean;
  label?: PurchasedLabel;
  error?: string;
}

// ── Void ───────────────────────────────────────────────────────────────
export interface VoidResult {
  success: boolean;
  error?: string;
}

export interface VoidLabelInput {
  labelId: string;
  sellerId: string;
  reason?: string;
}

// ── Tracking ───────────────────────────────────────────────────────────
export interface TrackingEvent {
  providerEventId: string;
  status: string;
  statusDetail?: string;
  location?: string;
  occurredAt: Date;
}

export interface TrackingWebhookData {
  trackingNumber: string;
  carrier: string;
  status: string;
  events: TrackingEvent[];
}

// ── Manifest ───────────────────────────────────────────────────────────
export interface ManifestInput {
  sellerId: string;
  carrier: string;
  shipDate: Date;
}

export interface ManifestResult {
  providerManifestId: string;
  manifestUrl?: string;
  labelCount: number;
  carrier: string;
}

export interface ManifestData {
  id: string;
  carrier: string;
  labelCount: number;
  manifestUrl?: string;
  status: string;
}

// ── Address Validation ─────────────────────────────────────────────────
export interface AddressValidationResult {
  isValid: boolean;
  messages: string[];
  suggestedAddress?: AddressInput;
}

// ── Return Label ───────────────────────────────────────────────────────
export type ReturnShippingPayer = 'BUYER' | 'SELLER' | 'PLATFORM';

export interface ReturnLabelInput {
  returnRequestId: string;
  orderId: string;
  sellerId: string;
  buyerId: string;
  fromAddress: AddressInput;
  toAddress: AddressInput;
  parcel: ParcelInput;
  paidBy: ReturnShippingPayer;
}

// ── Carrier ────────────────────────────────────────────────────────────
export interface CarrierService {
  carrier: string;
  carrierCode: string;
  service: string;
  serviceCode: string;
  domestic: boolean;
  international: boolean;
}

// ── Label Status ───────────────────────────────────────────────────────
export type LabelStatus =
  | 'PURCHASED'
  | 'PRINTED'
  | 'USED'
  | 'VOID_PENDING'
  | 'VOIDED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'ERROR';

// ── Shipment Status (mirrors enum) ────────────────────────────────────
export type ShipmentStatus =
  | 'PENDING'
  | 'LABEL_CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'LOST'
  | 'DAMAGED_IN_TRANSIT'
  | 'RETURN_TO_SENDER';
