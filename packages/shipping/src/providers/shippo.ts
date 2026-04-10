/**
 * @twicely/shipping - Shippo provider implementation
 *
 * Uses the Shippo REST API via fetch (NOT the SDK).
 * All amounts converted to integer cents immediately:
 *   Math.round(parseFloat(rate.amount) * 100)
 */

import type { ShippingProviderInterface } from '../provider-interface';
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
  TrackingEvent,
} from '../types';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const SHIPPO_BASE_URL = 'https://api.goshippo.com';

function getApiKey(): string {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error('SHIPPO_API_KEY environment variable is not set');
  return key;
}

function shippoHeaders(): Record<string, string> {
  return {
    'Authorization': 'ShippoToken ' + getApiKey(),
    'Content-Type': 'application/json',
  };
}

/** Convert Shippo float amount string to integer cents */
function toCents(amount: string | number): number {
  return Math.round(parseFloat(String(amount)) * 100);
}

function mapAddressToShippo(addr: AddressInput): Record<string, string | undefined> {
  return {
    name: addr.name,
    street1: addr.street1,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country,
    phone: addr.phone,
    email: addr.email,
  };
}

const SHIPPO_STATUS_MAP: Record<string, string> = {
  PRE_TRANSIT: 'LABEL_CREATED',
  TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURN_TO_SENDER',
  FAILURE: 'FAILED',
};

interface ShippoRate {
  object_id: string;
  amount: string;
  currency: string;
  provider: string;
  carrier_account: string;
  servicelevel: { name: string; token: string };
  estimated_days: number | null;
  duration_terms: string | null;
  attributes: string[];
  amount_local: string;
  messages: Array<{ text: string }>;
}

interface ShippoTransaction {
  object_id: string;
  tracking_number: string;
  label_url: string;
  rate: string;
  status: string;
  messages: Array<{ text: string }>;
}

interface ShippoTrackingEvent {
  object_id: string;
  status: string;
  status_details: string;
  status_date: string;
  location: { city: string; state: string; zip: string; country: string };
}

export class ShippoProvider implements ShippingProviderInterface {
  readonly name = 'shippo';

  async getRates(input: RateRequest): Promise<RateResult[]> {
    const body = {
      address_from: mapAddressToShippo(input.fromAddress),
      address_to: mapAddressToShippo(input.toAddress),
      parcels: [{
        length: String(input.parcel.lengthIn),
        width: String(input.parcel.widthIn),
        height: String(input.parcel.heightIn),
        distance_unit: 'in',
        weight: String(input.parcel.weightOz),
        mass_unit: 'oz',
      }],
      async: false,
    };

    const resp = await fetch(SHIPPO_BASE_URL + '/shipments', {
      method: 'POST',
      headers: shippoHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const respText = await resp.text();
      logger.error('[shippo] getRates failed', { status: resp.status, body: respText });
      throw new Error('Shippo getRates failed: ' + String(resp.status));
    }

    const data = await resp.json() as { rates: ShippoRate[] };
    const enabledCarriers = input.carriers ?? [];

    return (data.rates ?? [])
      .filter((r: ShippoRate) => {
        if (enabledCarriers.length === 0) return true;
        return enabledCarriers.some(c => r.provider.toUpperCase().includes(c.toUpperCase()));
      })
      .map((r: ShippoRate): RateResult => ({
        carrier: r.provider,
        carrierCode: r.provider.toUpperCase().replace(/\s+/g, '_'),
        service: r.servicelevel.name,
        serviceCode: r.servicelevel.token,
        rateCents: toCents(r.amount),
        surchargesCents: 0,
        totalCents: toCents(r.amount),
        currency: r.currency,
        etaDays: r.estimated_days,
        etaBusinessDays: r.estimated_days,
        guaranteedDelivery: r.attributes.includes('BESTVALUE') || r.attributes.includes('FASTEST'),
        providerRateId: r.object_id,
        carrierAccountId: r.carrier_account,
        insuranceAvailable: true,
        insuranceCostCents: undefined,
        retailRateCents: r.amount_local ? toCents(r.amount_local) : undefined,
        savingsPercent: r.amount_local
          ? Math.round((1 - parseFloat(r.amount) / parseFloat(r.amount_local)) * 100)
          : undefined,
      }));
  }

  async purchaseLabel(rateId: string, options: PurchaseOptions): Promise<LabelResult> {
    const body: Record<string, unknown> = {
      rate: rateId,
      label_file_type: options.labelFormat || 'PDF',
      async: false,
    };

    if (options.signatureType) {
      body.metadata = 'signature_required:' + options.signatureType;
    }

    const resp = await fetch(SHIPPO_BASE_URL + '/transactions', {
      method: 'POST',
      headers: shippoHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const respText = await resp.text();
      logger.error('[shippo] purchaseLabel failed', { status: resp.status, body: respText });
      throw new Error('Shippo purchaseLabel failed: ' + String(resp.status));
    }

    const tx = await resp.json() as ShippoTransaction;

    if (tx.status === 'ERROR') {
      const msgs = tx.messages?.map((m: { text: string }) => m.text).join('; ') ?? 'Unknown error';
      throw new Error('Shippo label error: ' + msgs);
    }

    const rateResp = await fetch(SHIPPO_BASE_URL + '/rates/' + rateId, {
      headers: shippoHeaders(),
    });
    const rateData = await rateResp.json() as ShippoRate;

    const insuranceRatePct = await getPlatformSetting<number>(
      'fulfillment.shipping.insuranceRatePercent',
      1,
    );
    const insuranceCost = options.includeInsurance
      ? Math.round(options.insuredValueCents * (insuranceRatePct / 100))
      : 0;

    return {
      providerLabelId: tx.object_id,
      providerRateId: rateId,
      providerShipmentId: undefined,
      trackingNumber: tx.tracking_number,
      labelUrl: tx.label_url,
      carrier: rateData.provider,
      carrierCode: rateData.provider.toUpperCase().replace(/\s+/g, '_'),
      service: rateData.servicelevel.name,
      serviceCode: rateData.servicelevel.token,
      rateCents: toCents(rateData.amount),
      surchargesCents: 0,
      insuranceCostCents: insuranceCost,
      totalCostCents: toCents(rateData.amount) + insuranceCost,
      retailRateCents: rateData.amount_local ? toCents(rateData.amount_local) : undefined,
      carrierAccountId: rateData.carrier_account,
      labelFormat: options.labelFormat || 'PDF',
    };
  }

  async voidLabel(providerLabelId: string): Promise<VoidResult> {
    const resp = await fetch(SHIPPO_BASE_URL + '/transactions/' + providerLabelId, {
      method: 'DELETE',
      headers: shippoHeaders(),
    });

    if (resp.ok || resp.status === 204) {
      return { success: true };
    }

    const respText = await resp.text();
    logger.error('[shippo] voidLabel failed', { status: resp.status, body: respText });
    return { success: false, error: 'Void failed: ' + String(resp.status) };
  }

  async validateAddress(address: AddressInput): Promise<AddressValidationResult> {
    const body = {
      ...mapAddressToShippo(address),
      validate: true,
    };

    const resp = await fetch(SHIPPO_BASE_URL + '/addresses', {
      method: 'POST',
      headers: shippoHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      return { isValid: false, messages: ['Address validation request failed'] };
    }

    const data = await resp.json() as {
      validation_results: { is_valid: boolean; messages: Array<{ text: string }> };
      street1: string; street2: string; city: string; state: string; zip: string; country: string;
    };

    const validation = data.validation_results;
    const messages = (validation?.messages ?? []).map((m: { text: string }) => m.text);

    const result: AddressValidationResult = {
      isValid: validation?.is_valid ?? false,
      messages,
    };

    if (validation?.is_valid && data.street1) {
      result.suggestedAddress = {
        name: address.name,
        street1: data.street1,
        street2: data.street2 || undefined,
        city: data.city,
        state: data.state,
        zip: data.zip,
        country: data.country,
      };
    }

    return result;
  }

  async createManifest(carrier: string, labelIds: string[], shipDate: Date): Promise<ManifestResult> {
    const body = {
      carrier_account: carrier,
      shipment_date: shipDate.toISOString(),
      transactions: labelIds,
      async: false,
    };

    const resp = await fetch(SHIPPO_BASE_URL + '/manifests', {
      method: 'POST',
      headers: shippoHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const respText = await resp.text();
      logger.error('[shippo] createManifest failed', { status: resp.status, body: respText });
      throw new Error('Shippo createManifest failed: ' + String(resp.status));
    }

    const data = await resp.json() as {
      object_id: string;
      documents: string[];
      transactions: string[];
      carrier_account: string;
    };

    return {
      providerManifestId: data.object_id,
      manifestUrl: data.documents?.[0],
      labelCount: data.transactions?.length ?? labelIds.length,
      carrier,
    };
  }

  parseTrackingWebhook(payload: unknown): TrackingWebhookData | null {
    if (!payload || typeof payload !== 'object') return null;

    const data = payload as {
      data?: {
        tracking_number?: string;
        carrier?: string;
        tracking_status?: { object_id?: string; status?: string; status_details?: string; status_date?: string };
        tracking_history?: ShippoTrackingEvent[];
      };
    };

    const trackingData = data.data;
    if (!trackingData?.tracking_number) return null;

    const currentStatus = trackingData.tracking_status;
    const mappedStatus = currentStatus?.status
      ? (SHIPPO_STATUS_MAP[currentStatus.status] ?? currentStatus.status)
      : 'UNKNOWN';

    const events: TrackingEvent[] = (trackingData.tracking_history ?? []).map(
      (evt: ShippoTrackingEvent) => ({
        providerEventId: evt.object_id,
        status: SHIPPO_STATUS_MAP[evt.status] ?? evt.status,
        statusDetail: evt.status_details,
        location: evt.location
          ? [evt.location.city, evt.location.state, evt.location.zip].filter(Boolean).join(', ')
          : undefined,
        occurredAt: new Date(evt.status_date),
      })
    );

    return {
      trackingNumber: trackingData.tracking_number,
      carrier: trackingData.carrier ?? 'UNKNOWN',
      status: mappedStatus,
      events,
    };
  }
}
