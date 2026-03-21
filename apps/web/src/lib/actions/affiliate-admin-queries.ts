'use server';

import { z } from 'zod';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getCommissionsForAdmin,
  getPayoutsForAdmin,
  getAffiliatePayoutList,
  type CommissionAdminRow,
  type PayoutAdminRow,
  type AffiliatePayoutAdminRow,
} from '@/lib/queries/affiliate-payout-admin';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const fetchCommissionsSchema = z.object({
  affiliateId: z.string().min(1),
  status: z.string().optional(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
}).strict();

const fetchPayoutsSchema = z.object({
  affiliateId: z.string().min(1),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
}).strict();

const fetchAffiliatePayoutListSchema = z.object({
  status: z.string().optional(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
}).strict();

// ─── Action 1: fetchCommissionsForAdmin ──────────────────────────────────────

export async function fetchCommissionsForAdmin(input: unknown): Promise<{
  success: boolean;
  rows?: CommissionAdminRow[];
  total?: number;
  error?: string;
}> {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = fetchCommissionsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { affiliateId, status, page, pageSize } = parsed.data;
  const { rows, total } = await getCommissionsForAdmin({
    affiliateId,
    status,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { success: true, rows, total };
}

// ─── Action 2: fetchPayoutsForAdmin ──────────────────────────────────────────

export async function fetchPayoutsForAdmin(input: unknown): Promise<{
  success: boolean;
  rows?: PayoutAdminRow[];
  total?: number;
  error?: string;
}> {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'AffiliatePayout')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = fetchPayoutsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { affiliateId, page, pageSize } = parsed.data;
  const { rows, total } = await getPayoutsForAdmin({
    affiliateId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { success: true, rows, total };
}

// ─── Action 3: fetchAffiliatePayoutList ──────────────────────────────────────

export async function fetchAffiliatePayoutList(input: unknown): Promise<{
  success: boolean;
  rows?: AffiliatePayoutAdminRow[];
  total?: number;
  error?: string;
}> {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'AffiliatePayout')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = fetchAffiliatePayoutListSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { status, page, pageSize } = parsed.data;
  const { rows, total } = await getAffiliatePayoutList({
    status,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { success: true, rows, total };
}
