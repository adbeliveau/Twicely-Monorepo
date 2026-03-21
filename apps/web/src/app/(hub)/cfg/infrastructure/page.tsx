import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EnvironmentSettings } from '@/components/admin/settings/environment-settings';

export const metadata: Metadata = { title: 'Infrastructure Settings | Twicely Hub' };

const VALKEY_KEYS = ['infrastructure.valkey.host', 'infrastructure.valkey.port'];
const TYPESENSE_KEYS = ['infrastructure.typesense.url'];
const CENTRIFUGO_KEYS = ['infrastructure.centrifugo.apiUrl'];

export default async function InfrastructureSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const settings = await getSettingsByKeys([...VALKEY_KEYS, ...TYPESENSE_KEYS, ...CENTRIFUGO_KEYS]);

  const grouped = {
    'Valkey (Cache & Queues)': settings.filter((s) => VALKEY_KEYS.includes(s.key)),
    'Typesense (Search)': settings.filter((s) => TYPESENSE_KEYS.includes(s.key)),
    'Centrifugo (Real-Time)': settings.filter((s) => CENTRIFUGO_KEYS.includes(s.key)),
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Infrastructure</span>
      </div>

      <AdminPageHeader
        title="Infrastructure"
        description="Service connection settings — loaded at startup from DB, overrides environment variables."
      />

      <EnvironmentSettings groupedSettings={grouped} canEdit={canEdit} />

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-semibold text-yellow-900">Important Notes</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-800">
          <li>These settings override environment variables when populated in the database</li>
          <li>
            <strong>Restart required</strong> — loaded once at application startup via{' '}
            <code className="rounded bg-yellow-100 px-1">loadInfraConfig()</code>
          </li>
          <li>
            API keys (Typesense, Centrifugo) remain in environment variables — they are sensitive
            and not stored here
          </li>
          <li>
            In production, only 3 env vars are needed:{' '}
            <code className="rounded bg-yellow-100 px-1">DATABASE_URL</code>,{' '}
            <code className="rounded bg-yellow-100 px-1">BETTER_AUTH_SECRET</code>,{' '}
            <code className="rounded bg-yellow-100 px-1">MASTER_ENCRYPTION_KEY</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
