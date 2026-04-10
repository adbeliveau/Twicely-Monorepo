/**
 * Tax exemption management — resale certificates, nonprofit exemptions
 */

import type { TaxExemption } from './types';

export type CreateExemptionInput = {
  buyerId: string;
  certificateNumber: string;
  state: string;
  exemptionType: TaxExemption['exemptionType'];
  validFrom: Date;
  validTo?: Date;
};

export async function createExemption(_input: CreateExemptionInput): Promise<TaxExemption> {
  // TODO: Insert into taxExemption table via Drizzle
  throw new Error('Not yet implemented — requires DB wiring');
}

export async function getExemption(_id: string): Promise<TaxExemption | null> {
  // TODO: Query taxExemption table
  throw new Error('Not yet implemented — requires DB wiring');
}

export async function getExemptionsForBuyer(_buyerId: string): Promise<TaxExemption[]> {
  // TODO: Query taxExemption table by buyerId
  return [];
}

export async function checkExemption(buyerId: string, state: string): Promise<TaxExemption | null> {
  const exemptions = await getExemptionsForBuyer(buyerId);
  return exemptions.find(e =>
    e.state === state &&
    e.isActive &&
    new Date() >= e.validFrom &&
    (!e.validTo || new Date() <= e.validTo)
  ) ?? null;
}

export async function deactivateExemption(_id: string): Promise<void> {
  // TODO: Set isActive = false
  throw new Error('Not yet implemented — requires DB wiring');
}
