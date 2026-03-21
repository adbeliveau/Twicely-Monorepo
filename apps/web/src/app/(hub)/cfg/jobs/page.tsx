import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EnvironmentSettings } from '@/components/admin/settings/environment-settings';

export const metadata: Metadata = { title: 'Jobs & Scheduler | Twicely Hub' };

const CRON_KEYS = [
  'jobs.cron.orders.pattern',
  'jobs.cron.returns.pattern',
  'jobs.cron.shipping.pattern',
  'jobs.cron.health.pattern',
  'jobs.cron.vacation.pattern',
  'jobs.cron.sellerScoreRecalc.pattern',
];

const SCHEDULER_KEYS = ['jobs.scheduler.tickIntervalMs'];

export default async function JobsSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const settings = await getSettingsByKeys([...CRON_KEYS, ...SCHEDULER_KEYS]);

  const grouped = {
    'Cron Jobs': settings.filter((s) => CRON_KEYS.includes(s.key)),
    'Scheduler': settings.filter((s) => SCHEDULER_KEYS.includes(s.key)),
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Jobs &amp; Scheduler</span>
      </div>

      <AdminPageHeader
        title="Jobs & Scheduler"
        description="Configure cron job schedules and scheduler timings. Changes take effect on next application restart."
      />

      <EnvironmentSettings groupedSettings={grouped} canEdit={canEdit} />

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900">Cron Pattern Format</h3>
        <p className="mt-1 text-sm text-blue-800">
          Standard cron format:{' '}
          <code className="rounded bg-blue-100 px-1">minute hour day month weekday</code>
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-800">
          <li><code>0 * * * *</code> — Every hour (on the hour)</li>
          <li><code>*/5 * * * *</code> — Every 5 minutes</li>
          <li><code>0 2 * * *</code> — Daily at 2:00 AM UTC</li>
          <li><code>tickIntervalMs</code> is in milliseconds (5000 = 5 seconds)</li>
        </ul>
        <p className="mt-2 text-xs text-blue-700">
          Pattern changes take effect when the job is next registered (application restart).
        </p>
      </div>
    </div>
  );
}
