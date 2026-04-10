/**
 * @twicely/shipping — Provider abstraction layer
 *
 * Platform code calls ShippingProviderInterface, never raw SDK.
 * Shippo is the default implementation; EasyPost/PirateShip can
 * be added by implementing this interface.
 */

import type {
  RateRequest,
  RateResult,
  PurchaseOptions,
  LabelResult,
  VoidResult,
  AddressInput,
  AddressValidationResult,
  ManifestResult,
  TrackingWebhookData,
} from './types';

export interface ShippingProviderInterface {
  /** Provider identifier (e.g. 'shippo', 'easypost') */
  readonly name: string;

  /** Fetch rates for a shipment */
  getRates(input: RateRequest): Promise<RateResult[]>;

  /** Purchase a label from a specific rate */
  purchaseLabel(rateId: string, options: PurchaseOptions): Promise<LabelResult>;

  /** Void/cancel a purchased label */
  voidLabel(providerLabelId: string): Promise<VoidResult>;

  /** Validate an address */
  validateAddress(address: AddressInput): Promise<AddressValidationResult>;

  /** Create end-of-day manifest for a carrier */
  createManifest(carrier: string, labelIds: string[], shipDate: Date): Promise<ManifestResult>;

  /** Parse incoming tracking webhook payload into normalized data */
  parseTrackingWebhook(payload: unknown): TrackingWebhookData | null;
}
