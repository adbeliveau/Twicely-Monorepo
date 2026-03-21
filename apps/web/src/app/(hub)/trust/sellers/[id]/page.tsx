// NAV_ENTRY (sub-page, no nav entry needed — reached via /trust links)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSellerTrustProfile, getSellerScoreHistory } from '@/lib/queries/admin-trust';
import { updateBandOverride as updateBandOverrideAction, revokeBandOverride as revokeBandOverrideAction } from '@/lib/actions/admin-trust';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

async function handleSetOverride(formData: FormData): Promise<void> {
  'use server';
  await updateBandOverrideAction({
    userId: formData.get('userId') as string,
    newBand: formData.get('newBand') as string,
    reason: formData.get('reason') as string,
    expiresInDays: parseInt(formData.get('expiresInDays') as string, 10) || 90,
  });
}

async function handleRevokeOverride(formData: FormData): Promise<void> {
  'use server';
  await revokeBandOverrideAction({
    userId: formData.get('userId') as string,
    reason: formData.get('reason') as string,
  });
}

export const metadata: Metadata = { title: 'Seller Trust Profile | Twicely Hub' };

const BAND_COLORS: Record<string, string> = {
  POWER_SELLER: '#7C3AED',
  TOP_RATED: '#F59E0B',
  ESTABLISHED: '#10B981',
  EMERGING: '#6B7280',
  SUSPENDED: '#EF4444',
};

const METRIC_WEIGHTS: Record<string, string> = {
  onTimeShipping: '25%',
  inadRate: '20%',
  reviewAverage: '20%',
  responseTime: '15%',
  returnRate: '10%',
  cancelRate: '10%',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SellerTrustProfilePage({ params }: PageProps) {
  const { id } = await params;
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'TrustSafety')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [profile, history] = await Promise.all([
    getSellerTrustProfile(id),
    getSellerScoreHistory(id, 90),
  ]);

  if (!profile) notFound();

  const canOverride = ability.can('update', 'SellerProfile');
  const bandColor = BAND_COLORS[profile.performanceBand] ?? '#6B7280';

  return (
    <div className="space-y-6">
      <AdminPageHeader title={`${profile.name} — Trust Profile`} />

      {/* Hero Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Trust Score</p>
            <p className="text-4xl font-bold text-gray-900">{profile.trustScore.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Performance Score</p>
            <p className="text-4xl font-bold text-gray-900">{profile.sellerScore}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Band</p>
            <span className="inline-block rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: bandColor }}>
              {profile.performanceBand.replace('_', ' ')}
            </span>
          </div>
          {profile.enforcementLevel && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Enforcement</p>
              <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">{profile.enforcementLevel}</span>
            </div>
          )}
          {profile.bandOverride && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-800">Override: {profile.bandOverride.replace('_', ' ')}</p>
              {profile.bandOverrideReason && <p className="text-xs text-amber-600">{profile.bandOverrideReason}</p>}
              {profile.bandOverrideExpiresAt && <p className="text-xs text-amber-600">Expires: {profile.bandOverrideExpiresAt.toLocaleDateString()}</p>}
            </div>
          )}
          {profile.isNew && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">New Seller</span>}
        </div>
        <div className="mt-3 flex gap-4 text-sm text-gray-500">
          <span>{profile.email}</span>
          <Link href={`/usr/${profile.userId}`} className="text-primary hover:underline">Full User Profile</Link>
          <Link href={`/mod/enforcement?seller=${profile.userId}`} className="text-primary hover:underline">Enforcement Actions</Link>
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Performance Metrics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard label="On-Time Shipping" value={`${((profile.onTimeShippingPct ?? 0) * 100).toFixed(1)}%`} weight={METRIC_WEIGHTS['onTimeShipping']!} ideal="≥ 96%" />
          <MetricCard label="INAD Rate" value={`${(profile.inadRate * 100).toFixed(2)}%`} weight={METRIC_WEIGHTS['inadRate']!} ideal="< 0.5%" />
          <MetricCard label="Review Average" value={profile.averageRating !== null ? profile.averageRating.toFixed(2) : 'N/A'} weight={METRIC_WEIGHTS['reviewAverage']!} ideal="≥ 4.8" />
          <MetricCard label="Avg Response Time" value={profile.avgResponseTimeHours !== null ? `${profile.avgResponseTimeHours.toFixed(1)}h` : 'N/A'} weight={METRIC_WEIGHTS['responseTime']!} ideal="< 12h" />
          <MetricCard label="Return Rate" value={`${(profile.returnRate * 100).toFixed(2)}%`} weight={METRIC_WEIGHTS['returnRate']!} ideal="< 3%" />
          <MetricCard label="Cancellation Rate" value={`${(profile.cancelRate * 100).toFixed(2)}%`} weight={METRIC_WEIGHTS['cancelRate']!} ideal="< 0.5%" />
        </div>
      </div>

      {/* Score History Table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Score History (Last 90 Days)</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>{['Date', 'Score', 'Band', 'Ship', 'INAD', 'Review', 'Response', 'Return', 'Cancel', 'Trend'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-4 text-center text-gray-400">No score history available</td></tr>
              ) : history.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{s.snapshotDate ?? '—'}</td>
                  <td className="px-3 py-2 font-medium">{s.overallScore.toFixed(0)}</td>
                  <td className="px-3 py-2">{s.performanceBand.replace('_', ' ')}</td>
                  <td className="px-3 py-2">{s.shippingScore ?? '—'}</td>
                  <td className="px-3 py-2">{s.inadScore ?? '—'}</td>
                  <td className="px-3 py-2">{s.reviewScore ?? '—'}</td>
                  <td className="px-3 py-2">{s.responseScore ?? '—'}</td>
                  <td className="px-3 py-2">{s.returnScore ?? '—'}</td>
                  <td className="px-3 py-2">{s.cancellationScore ?? '—'}</td>
                  <td className="px-3 py-2">{s.trendModifier !== null ? s.trendModifier.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Controls — ADMIN only */}
      {canOverride && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Band Override (Admin Only)</h2>
          {profile.bandOverride ? (
            <form action={handleRevokeOverride}>
              <input type="hidden" name="userId" value={profile.userId} />
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Active override: <strong>{profile.bandOverride.replace('_', ' ')}</strong></p>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Revoke reason (required)</label>
                  <input name="reason" type="text" required minLength={5} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Reason for revoking override..." />
                </div>
                <button type="submit" className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Revoke Override</button>
              </div>
            </form>
          ) : (
            <form action={handleSetOverride}>
              <input type="hidden" name="userId" value={profile.userId} />
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">New Band</label>
                  <select name="newBand" className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="POWER_SELLER">POWER SELLER</option>
                    <option value="TOP_RATED">TOP RATED</option>
                    <option value="ESTABLISHED">ESTABLISHED</option>
                    <option value="EMERGING">EMERGING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Reason (min 10 chars)</label>
                  <textarea name="reason" required minLength={10} maxLength={500} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Explain why this band override is warranted..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Expires in (days, default 90)</label>
                  <input name="expiresInDays" type="number" min={1} max={365} defaultValue={90} className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Set Band Override</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, weight, ideal }: { label: string; value: string; weight: string; ideal: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
        <span>Weight: {weight}</span>
        <span>Ideal: {ideal}</span>
      </div>
    </div>
  );
}
