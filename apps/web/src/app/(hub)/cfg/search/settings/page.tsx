import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EnvironmentSettings } from '@/components/admin/settings/environment-settings';

export const metadata: Metadata = { title: 'Search Settings | Twicely Hub' };

const ENGINE_KEYS = [
  'search.engine',
  'search.opensearch.dualWrite',
  'search.opensearch.fuzziness',
];

const INDEX_KEYS = [
  'search.opensearch.numberOfShards',
  'search.opensearch.numberOfReplicas',
  'search.reindex.batchSize',
  'search.reindex.concurrency',
];

const INFRA_KEYS = [
  'infrastructure.opensearch.url',
];

export default async function SearchSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const settings = await getSettingsByKeys([...ENGINE_KEYS, ...INDEX_KEYS, ...INFRA_KEYS]);

  const grouped = {
    'Engine Configuration': settings.filter((s) => ENGINE_KEYS.includes(s.key)),
    'Index Configuration': settings.filter((s) => INDEX_KEYS.includes(s.key)),
    'Infrastructure': settings.filter((s) => INFRA_KEYS.includes(s.key)),
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Settings</span>
      </div>

      <AdminPageHeader
        title="Search Engine Settings"
        description="Engine selection, OpenSearch configuration, and reindex parameters."
      />

      <EnvironmentSettings groupedSettings={grouped} canEdit={canEdit} />

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900">Migration Guide</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-800">
          <li><strong>search.engine</strong>: &quot;typesense&quot; (default) | &quot;opensearch&quot; | &quot;postgres&quot;</li>
          <li><strong>search.opensearch.dualWrite</strong>: Enable to write to both engines during migration</li>
          <li>Change <strong>search.engine</strong> to &quot;opensearch&quot; once the reindex is validated</li>
          <li>Infrastructure URL change requires application restart</li>
        </ul>
      </div>
    </div>
  );
}
