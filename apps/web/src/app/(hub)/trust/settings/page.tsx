// NAV_ENTRY (sub-page, no nav entry needed)

import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys } from '@/lib/queries/admin-settings';
import { updateSettingAction } from '@/lib/actions/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Trust Score Configuration | Twicely Hub' };

const BAND_THRESHOLD_KEYS = [
  'trust.baseScore',
  'trust.bandExcellentMin',
  'trust.bandGoodMin',
  'trust.bandWatchMin',
  'trust.bandLimitedMin',
  'trust.volumeCapped',
  'trust.volumeLimited',
  'trust.decayHalfLifeDays',
];

const EVENT_WEIGHT_KEYS = [
  'trust.event.review5Star',
  'trust.event.review4Star',
  'trust.event.review3Star',
  'trust.event.review2Star',
  'trust.event.review1Star',
  'trust.event.lateShipment',
  'trust.event.sellerCancel',
  'trust.event.refundSellerFault',
  'trust.event.disputeOpened',
  'trust.event.disputeSellerFault',
  'trust.event.chargeback',
  'trust.event.policyViolation',
];

const STANDARDS_KEYS = [
  'trust.standards.evaluationPeriodDays',
  'trust.standards.minOrdersForEvaluation',
  'trust.standards.maxDefectRatePercent',
  'trust.standards.maxLateShipRatePercent',
  'trust.standards.maxUnresolvedCasesPercent',
  'trust.standards.topRatedMaxDefectRate',
  'trust.standards.topRatedMaxLateShipRate',
  'trust.standards.topRatedMinOrdersYear',
  'trust.standards.belowStandardVisibilityReduction',
  'trust.standards.restrictedMaxListings',
  'trust.standards.defectExpiryDays',
  'trust.standards.belowStandardTfSurcharge',
];

const LABEL_OVERRIDES: Record<string, string> = {
  'trust.standards.belowStandardTfSurcharge': 'Below Standard TF Surcharge (%)',
};

function getLabel(key: string): string {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const part = key.split('.').pop() ?? key;
  return part.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

async function saveSetting(formData: FormData) {
  'use server';
  const settingId = formData.get('settingId') as string;
  const rawValue = formData.get('value') as string;
  const reason = formData.get('reason') as string;
  const numValue = Number(rawValue);
  const value = isNaN(numValue) ? rawValue : numValue;
  await updateSettingAction({ settingId, value, reason: reason || 'Trust settings update' });
}

interface SettingEntry { id: string; value: unknown }

function SettingRow({ dbKey, entry }: { dbKey: string; entry: SettingEntry | undefined }) {
  const val = entry?.value !== undefined ? String(entry.value) : '';
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{getLabel(dbKey)}</p>
        <p className="text-xs text-gray-400">{dbKey}</p>
      </div>
      {entry?.id ? (
        <form action={saveSetting} className="flex items-center gap-2">
          <input type="hidden" name="settingId" value={entry.id} />
          <input name="value" defaultValue={val} className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm" />
          <input type="hidden" name="reason" value="Trust score configuration update" />
          <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90">Save</button>
        </form>
      ) : (
        <span className="text-xs text-gray-400">Not seeded</span>
      )}
    </div>
  );
}

export default async function TrustScoreConfigPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const allKeys = [...BAND_THRESHOLD_KEYS, ...EVENT_WEIGHT_KEYS, ...STANDARDS_KEYS];
  const rows = await getSettingsByKeys(allKeys);
  const valueMap = new Map(rows.map((r) => [r.key, { id: r.id, value: r.value }]));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Trust Score Configuration"
        description="Configure trust event weights, band thresholds, and enforcement parameters"
      />

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Band Thresholds</h2>
        {BAND_THRESHOLD_KEYS.map((k) => (
          <SettingRow key={k} dbKey={k} entry={valueMap.get(k)} />
        ))}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Event Weights</h2>
        {EVENT_WEIGHT_KEYS.map((k) => (
          <SettingRow key={k} dbKey={k} entry={valueMap.get(k)} />
        ))}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Seller Standards</h2>
        {STANDARDS_KEYS.map((k) => (
          <SettingRow key={k} dbKey={k} entry={valueMap.get(k)} />
        ))}
      </section>
    </div>
  );
}
