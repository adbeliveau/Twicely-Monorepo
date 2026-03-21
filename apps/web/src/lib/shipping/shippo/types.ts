/**
 * Shippo API response types
 * Only types what we actually consume from the Shippo SDK responses
 */

export interface ShippoServiceLevel {
  name?: string;
  token?: string;
}

export interface ShippoRate {
  provider?: string;
  servicelevel?: ShippoServiceLevel;
  amount?: string;
  currency?: string;
  estimatedDays?: number;
  objectId?: string;
}

export interface ShippoTransactionRate {
  provider?: string;
  servicelevel?: ShippoServiceLevel;
  amount?: string;
}
