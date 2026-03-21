import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdapterById } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProviderInstanceForm } from '@/components/admin/settings/provider-instance-form';
import type { ConfigField } from '@/components/admin/settings/provider-config-form';
import Link from 'next/link';

export const metadata: Metadata = { title: 'New Instance | Twicely Hub' };

interface Props {
  searchParams: Promise<{ adapter?: string }>;
}

export default async function NewInstancePage({ searchParams }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'ProviderInstance')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const adapterId = params.adapter;
  if (!adapterId) redirect('/cfg/providers/adapters');

  const adapter = await getAdapterById(adapterId);
  if (!adapter) redirect('/cfg/providers/adapters');

  const schema = (adapter.configSchemaJson ?? []) as ConfigField[];
  const canEdit = ability.can('create', 'ProviderInstance');

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Setup ${adapter.name}`}
        description={`Create a new ${adapter.name} provider instance and configure its settings`}
      />

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg/providers" className="hover:text-gray-700">Providers</Link>
        <span>/</span>
        <Link href="/cfg/providers/adapters" className="hover:text-gray-700">Adapters</Link>
        <span>/</span>
        <span className="text-gray-900">{adapter.name}</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <ProviderInstanceForm
          mode="create"
          adapterId={adapter.id}
          adapterName={adapter.name}
          configSchema={schema}
          canEdit={canEdit}
        />
      </div>

      {adapter.docsUrl && (
        <p className="text-xs text-gray-400">
          Need help? See the{' '}
          <a href={adapter.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800">{adapter.name} docs</a>.
        </p>
      )}
    </div>
  );
}
