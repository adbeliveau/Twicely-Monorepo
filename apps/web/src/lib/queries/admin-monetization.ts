/**
 * Admin Monetization Queries (F1.5)
 * Fee brackets, payout settings — reads from actual platform_setting keys
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { inArray } from 'drizzle-orm';

export interface TfBracket {
  bracket: number;
  minCents: number;
  maxCents: number | null;
  rateBps: number;
  maxCentsSettingId: string | null;
  rateSettingId: string | null;
}

export interface MonetizationOverview {
  tfBrackets: TfBracket[];
  minimumTfCents: number;
  minimumTfSettingId: string | null;
  escrowHoldHours: number;
  escrowSettingId: string | null;
  minimumPayoutCents: number;
  payoutSettingId: string | null;
  instantPayoutFeeCents: number;
  instantFeeSettingId: string | null;
}

const BRACKET_KEYS = Array.from({ length: 8 }, (_, i) => [
  `commerce.tf.bracket${i + 1}.maxCents`,
  `commerce.tf.bracket${i + 1}.rate`,
]).flat();

const EXTRA_KEYS = [
  'commerce.tf.minimumCents',
  'commerce.escrow.holdHours',
  'payout.minimumNoneCents',
  'payout.instantFeeCents',
];

export async function getMonetizationOverview(): Promise<MonetizationOverview> {
  const allKeys = [...BRACKET_KEYS, ...EXTRA_KEYS];
  const rows = await db
    .select({ id: platformSetting.id, key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(inArray(platformSetting.key, allKeys));

  const map = new Map(rows.map((r) => [r.key, { id: r.id, value: r.value }]));

  function val(key: string): number | null {
    const row = map.get(key);
    return typeof row?.value === 'number' ? row.value : null;
  }
  function id(key: string): string | null {
    return map.get(key)?.id ?? null;
  }

  // Build brackets from individual settings
  const DEFAULTS: Array<{ min: number; max: number | null; rate: number }> = [
    { min: 0, max: 49900, rate: 1000 },
    { min: 50000, max: 199900, rate: 1100 },
    { min: 200000, max: 499900, rate: 1050 },
    { min: 500000, max: 999900, rate: 1000 },
    { min: 1000000, max: 2499900, rate: 950 },
    { min: 2500000, max: 4999900, rate: 900 },
    { min: 5000000, max: 9999900, rate: 850 },
    { min: 10000000, max: null, rate: 800 },
  ];

  const tfBrackets: TfBracket[] = DEFAULTS.map((d, i) => {
    const n = i + 1;
    const maxKey = `commerce.tf.bracket${n}.maxCents`;
    const rateKey = `commerce.tf.bracket${n}.rate`;
    const rawMax = val(maxKey);
    return {
      bracket: n,
      minCents: i === 0 ? 0 : (val(`commerce.tf.bracket${i}.maxCents`) ?? d.min - 1) + 1,
      maxCents: rawMax === -1 ? null : (rawMax ?? d.max),
      rateBps: val(rateKey) ?? d.rate,
      maxCentsSettingId: id(maxKey),
      rateSettingId: id(rateKey),
    };
  });

  return {
    tfBrackets,
    minimumTfCents: val('commerce.tf.minimumCents') ?? 50,
    minimumTfSettingId: id('commerce.tf.minimumCents'),
    escrowHoldHours: val('commerce.escrow.holdHours') ?? 72,
    escrowSettingId: id('commerce.escrow.holdHours'),
    minimumPayoutCents: val('payout.minimumNoneCents') ?? 1500,
    payoutSettingId: id('payout.minimumNoneCents'),
    instantPayoutFeeCents: val('payout.instantFeeCents') ?? 250,
    instantFeeSettingId: id('payout.instantFeeCents'),
  };
}
