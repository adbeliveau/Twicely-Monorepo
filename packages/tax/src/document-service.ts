/**
 * Tax document generation — 1099-K, corrections, voids
 * Federal threshold read from platform_settings (IRS default $600).
 */

import type { TaxDocument } from './types';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const DEFAULT_FEDERAL_1099K_THRESHOLD_CENTS = 60000; // $600

export type GenerateDocumentInput = {
  sellerId: string;
  taxYear: number;
  grossAmountCents: number;
  transactionCount: number;
};

export async function meetsThreshold(grossAmountCents: number): Promise<boolean> {
  const thresholdCents = await getPlatformSetting<number>(
    'tax.1099kThresholdCents',
    DEFAULT_FEDERAL_1099K_THRESHOLD_CENTS,
  );
  return grossAmountCents >= thresholdCents;
}

export async function generateDocument(_input: GenerateDocumentInput): Promise<TaxDocument> {
  // TODO: Insert into taxDocument table, generate PDF
  throw new Error('Not yet implemented — requires DB wiring');
}

export async function getDocumentsForSeller(_sellerId: string, _taxYear?: number): Promise<TaxDocument[]> {
  // TODO: Query taxDocument table
  return [];
}

export async function voidDocument(_id: string): Promise<void> {
  // TODO: Set status = VOIDED, generate void notice
  throw new Error('Not yet implemented — requires DB wiring');
}

export async function correctDocument(_id: string, _corrections: Partial<GenerateDocumentInput>): Promise<TaxDocument> {
  // TODO: Create correction document, link to original
  throw new Error('Not yet implemented — requires DB wiring');
}

export async function generateAnnualDocuments(_taxYear: number): Promise<{ generated: number; skipped: number }> {
  // BullMQ cron job entry point
  // TODO: Query all sellers with grossAmount >= threshold, generate documents
  return { generated: 0, skipped: 0 };
}
