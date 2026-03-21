import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { runAllChecks } from '@/lib/monitoring/doctor-runner';
import { DoctorCheckTable } from '@/components/admin/doctor-check-table';
import { HealthStatusBanner } from '@/components/admin/health-status-banner';
import { RunChecksButton } from '@/components/admin/run-checks-button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Doctor Checks | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function DoctorPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'HealthCheck')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canManage = ability.can('manage', 'HealthCheck');

  // Run checks on page load for doctor page (this IS the detailed view)
  let summary = null;
  try {
    summary = await runAllChecks();
  } catch {
    // Checks failed — show empty state
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Doctor Checks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Per-module health verification of all system dependencies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && <RunChecksButton />}
          <Link href="/health" className="text-sm text-primary hover:underline">
            Back to Overview
          </Link>
        </div>
      </div>

      {summary && (
        <>
          <HealthStatusBanner status={summary.overall} />
          <DoctorCheckTable checks={summary.checks} />
        </>
      )}

      {!summary && (
        <p className="text-sm text-gray-500 py-8 text-center">
          Unable to run health checks. Check server logs for details.
        </p>
      )}
    </div>
  );
}
