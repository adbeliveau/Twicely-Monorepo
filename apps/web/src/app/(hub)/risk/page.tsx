// NAV_ENTRY: { label: 'Risk Signals', href: '/risk', icon: 'AlertTriangle', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] }

import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getRiskSignals } from '@/lib/queries/admin-trust-security';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { AlertTriangle, ShieldAlert, TrendingDown, Flag, Shield, Lock } from 'lucide-react';

export const metadata: Metadata = { title: 'Risk Signals | Twicely Hub' };

/** Fraud detection patterns — static reference per Actors/Security Section 13.2 */
const FRAUD_PATTERNS = [
  { name: 'Account Takeover', detection: 'Unusual login location, device change, rapid profile edits', action: 'Force re-auth, flag for manual review' },
  { name: 'Shill Buying', detection: 'Self-buying pattern, linked accounts, IP overlap with seller', action: 'Void transactions, restrict buyer account' },
  { name: 'Listing Hijack', detection: 'Price change after sale, description swap post-purchase', action: 'Revert listing, suspend seller' },
  { name: 'Drop Shipping Abuse', detection: 'Ship-from address mismatch, tracking origin vs declared', action: 'Enforcement action, policy warning' },
  { name: 'Return Fraud', detection: 'Empty box returns, item condition mismatch, serial swap', action: 'Deny refund, flag buyer account' },
  { name: 'Chargeback Abuse', detection: 'Repeat chargebacks on delivered orders, friendly fraud pattern', action: 'Ban buyer, dispute chargeback evidence' },
  { name: 'Velocity Abuse', detection: 'Rapid listing creation, bulk purchasing, account farming', action: 'Rate limit, manual review queue' },
];

export default async function RiskPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'TrustSafety')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const signals = await getRiskSignals();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Risk Signals"
        description="Fraud detection overview and risk monitoring"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Low Trust Sellers" value={signals.lowTrustSellers} icon={<TrendingDown className="h-4 w-4" />} color="error" />
        <StatCard label="Pre-Suspension" value={signals.preSuspensionSellers} icon={<AlertTriangle className="h-4 w-4" />} color="error" />
        <StatCard label="High Defect Rate" value={signals.highDefectSellers} icon={<ShieldAlert className="h-4 w-4" />} color="warning" />
        <StatCard label="Recent Fraud Flags (7d)" value={signals.recentFraudFlags} icon={<Flag className="h-4 w-4" />} color="error" />
        <StatCard label="Active Overrides" value={signals.activeOverrides} icon={<Lock className="h-4 w-4" />} color="warning" />
        <StatCard label="Restricted Sellers" value={signals.restrictedSellers} icon={<Shield className="h-4 w-4" />} color="error" />
      </div>

      {/* Fraud Detection Patterns — static reference panel */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Fraud Detection Patterns (Reference)</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Pattern</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Detection Method</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {FRAUD_PATTERNS.map((p) => (
                <tr key={p.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.detection}</td>
                  <td className="px-4 py-3 text-gray-600">{p.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">This panel is a reference guide. Live fraud detection is future scope.</p>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Link href="/mod/enforcement" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Enforcement Actions</h3>
          <p className="mt-1 text-xs text-gray-500">Track and manage enforcement actions</p>
        </Link>
        <Link href="/mod/reports" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Content Reports</h3>
          <p className="mt-1 text-xs text-gray-500">Review user-submitted content reports</p>
        </Link>
        <Link href="/security" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Security Events</h3>
          <p className="mt-1 text-xs text-gray-500">Authentication and security audit log</p>
        </Link>
        <Link href="/trust" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Trust Overview</h3>
          <p className="mt-1 text-xs text-gray-500">Seller trust scores and band distribution</p>
        </Link>
      </div>
    </div>
  );
}
