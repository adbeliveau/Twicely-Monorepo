import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPartitionedFlags } from '@/lib/queries/admin-feature-flags';
import { FeatureFlagTable } from '@/components/admin/feature-flag-table';
import { KillSwitchPanel } from '@/components/admin/kill-switch-panel';
import { LaunchGatePanel } from '@/components/admin/launch-gate-panel';
import { FlagSearchInput } from '@/components/admin/flag-search-input';
import { AlertTriangle, Rocket, ToggleLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Feature Flags | Twicely Hub',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeatureFlagsPage({ searchParams }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'FeatureFlag')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const raw = await searchParams;
  const rawQ = raw.q;
  const searchTerm = Array.isArray(rawQ) ? rawQ[0] : rawQ;

  const { killSwitches, launchGates, regularFlags } = await getPartitionedFlags(searchTerm);

  const canCreate = ability.can('create', 'FeatureFlag');
  const canDelete = ability.can('delete', 'FeatureFlag');

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Feature Flags</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage kill switches, launch gates, and feature rollouts.
          </p>
        </div>
      </div>

      <FlagSearchInput currentSearch={searchTerm} />

      {/* ── Section 1: Kill Switches ───────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">Kill Switches</h2>
          </div>
          <p className="mt-1 text-sm text-red-600">
            Emergency controls to instantly disable platform features.
            Disabling a kill switch immediately blocks all user access to that feature.
          </p>
        </div>
        <KillSwitchPanel flags={killSwitches} />
      </section>

      {/* ── Section 2: Launch Gates ───────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-blue-800">Launch Gates</h2>
          </div>
          <p className="mt-1 text-sm text-blue-600">
            Pre-launch checklist — open gates to enable features for production traffic.
          </p>
        </div>
        <LaunchGatePanel flags={launchGates} />
      </section>

      {/* ── Section 3: Feature Flags ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ToggleLeft className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-800">Feature Flags</h2>
        </div>
        <FeatureFlagTable
          flags={regularFlags}
          canCreate={canCreate}
          canDelete={canDelete}
        />
      </section>
    </div>
  );
}
