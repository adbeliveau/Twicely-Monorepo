// NAV_ENTRY: { label: 'Trust & Safety', href: '/trust', icon: 'ShieldCheck', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] }

import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTrustOverviewKPIs, getRecentBandTransitions } from '@/lib/queries/admin-trust';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import {
  Users, ShieldCheck, BarChart2, AlertTriangle, MessageSquare, Shield, Ban,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Trust & Safety | Twicely Hub' };

const BAND_COLORS: Record<string, string> = {
  POWER_SELLER: '#7C3AED',
  TOP_RATED: '#F59E0B',
  ESTABLISHED: '#10B981',
  EMERGING: '#6B7280',
  SUSPENDED: '#EF4444',
};

export default async function TrustPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'TrustSafety')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [kpis, transitions] = await Promise.all([
    getTrustOverviewKPIs(),
    getRecentBandTransitions(20),
  ]);

  const avgTrust = kpis.avgTrustScore.toFixed(1);
  const avgSeller = kpis.avgSellerScore.toFixed(0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Trust & Safety"
        description="Seller trust scores, performance bands, and enforcement overview"
      />

      {/* KPI Row — Row 1 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Sellers" value={kpis.totalSellers} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Avg Trust Score" value={avgTrust} icon={<ShieldCheck className="h-4 w-4" />} color="success" />
        <StatCard label="Avg Performance Score" value={avgSeller} icon={<BarChart2 className="h-4 w-4" />} />
        <StatCard label="Active Overrides" value={kpis.activeOverrides} icon={<AlertTriangle className="h-4 w-4" />} color="warning" />
      </div>

      {/* KPI Row — Row 2: Enforcement counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="In Coaching" value={kpis.enforcementCounts.coaching} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="In Warning" value={kpis.enforcementCounts.warning} icon={<AlertTriangle className="h-4 w-4" />} color="warning" />
        <StatCard label="In Restriction" value={kpis.enforcementCounts.restriction} icon={<Shield className="h-4 w-4" />} color="error" />
        <StatCard label="Pre-Suspension" value={kpis.enforcementCounts.preSuspension} icon={<Ban className="h-4 w-4" />} color="error" />
      </div>

      {/* Band Distribution */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Band Distribution</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {['POWER_SELLER', 'TOP_RATED', 'ESTABLISHED', 'EMERGING', 'SUSPENDED'].map((band) => {
            const entry = kpis.bandDistribution.find((b) => b.band === band);
            const cnt = entry?.count ?? 0;
            const color = BAND_COLORS[band] ?? '#6B7280';
            return (
              <div key={band} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-gray-600">{band.replace('_', ' ')}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{cnt}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Band Transitions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Recent Band Transitions</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Seller</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Previous Band</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">New Band</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Score</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transitions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">No recent band transitions</td></tr>
              ) : (
                transitions.map((t) => (
                  <tr key={`${t.userId}-${t.changedAt.toISOString()}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/trust/sellers/${t.userId}`} className="font-medium text-primary hover:underline">{t.userName}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${BAND_COLORS[t.previousBand] ?? '#6B7280'}20`, color: BAND_COLORS[t.previousBand] ?? '#6B7280' }}>{t.previousBand.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${BAND_COLORS[t.newBand] ?? '#6B7280'}20`, color: BAND_COLORS[t.newBand] ?? '#6B7280' }}>{t.newBand.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">{t.sellerScore.toFixed(0)}</td>
                    <td className="px-4 py-3 text-gray-500">{t.changedAt.toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Link href="/risk" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Risk Signals</h3>
          <p className="mt-1 text-xs text-gray-500">Fraud detection and risk monitoring</p>
        </Link>
        <Link href="/cfg/trust" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Trust Settings</h3>
          <p className="mt-1 text-xs text-gray-500">Configure auto-moderation and thresholds</p>
        </Link>
        <Link href="/trust/settings" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Score Configuration</h3>
          <p className="mt-1 text-xs text-gray-500">Event weights and band thresholds</p>
        </Link>
        <Link href="/security" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Security Events</h3>
          <p className="mt-1 text-xs text-gray-500">Authentication and security audit log</p>
        </Link>
      </div>
    </div>
  );
}
