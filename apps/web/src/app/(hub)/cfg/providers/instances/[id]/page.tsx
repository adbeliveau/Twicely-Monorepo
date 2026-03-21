import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getInstanceById, getAdapterById, getInstanceSecrets } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProviderInstanceForm } from '@/components/admin/settings/provider-instance-form';
import { InstanceCard } from '@/components/admin/settings/instance-card';
import type { ConfigField } from '@/components/admin/settings/provider-config-form';
import { decryptSecret, maskSecret } from '@/lib/crypto/provider-secrets';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Configure Instance | Twicely Hub' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InstanceConfigPage({ params }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderInstance')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const instance = await getInstanceById(id);
  if (!instance) notFound();

  const [adapter, rawSecrets] = await Promise.all([
    getAdapterById(instance.adapterId),
    getInstanceSecrets(id),
  ]);
  if (!adapter) notFound();

  const schema = (adapter.configSchemaJson ?? []) as ConfigField[];
  const configJson = (instance.configJson ?? {}) as Record<string, unknown>;

  // Build secret masks (decrypt → show last 4 chars)
  const secretMasks: Record<string, string> = {};
  for (const s of rawSecrets) {
    try {
      secretMasks[s.key] = maskSecret(decryptSecret(s.encryptedValue));
    } catch {
      secretMasks[s.key] = '••••••••';
    }
  }

  const canEdit = ability.can('update', 'ProviderInstance');

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Configure ${instance.displayName}`}
        description={`${adapter.name} provider instance settings and API keys`}
      />

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg/providers" className="hover:text-gray-700">Providers</Link>
        <span>/</span>
        <Link href="/cfg/providers/instances" className="hover:text-gray-700">Instances</Link>
        <span>/</span>
        <span className="text-gray-900">{instance.displayName}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <ProviderInstanceForm
              mode="edit"
              adapterId={adapter.id}
              adapterName={adapter.name}
              configSchema={schema}
              instanceId={instance.id}
              initialName={instance.name}
              initialDisplayName={instance.displayName}
              initialConfig={configJson}
              secretMasks={secretMasks}
              canEdit={canEdit}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-primary">Health</h3>
          <InstanceCard
            id={instance.id}
            name={instance.name}
            displayName={instance.displayName}
            adapterName={adapter.name}
            status={instance.status}
            lastHealthStatus={instance.lastHealthStatus}
            lastHealthLatencyMs={instance.lastHealthLatencyMs}
            lastHealthCheckAt={instance.lastHealthCheckAt}
          />
        </div>
      </div>
    </div>
  );
}
