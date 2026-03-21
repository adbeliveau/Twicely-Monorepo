import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { getInstalledDependencies } from '@/lib/queries/admin-dependency-status';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Integrations | Twicely Hub' };

const CATEGORY_LABELS: Record<string, string> = {
  framework: 'Framework & Runtime',
  database: 'Database',
  payments: 'Payments',
  shipping: 'Shipping',
  search: 'Search',
  auth: 'Authentication',
  email: 'Email',
  ui: 'UI',
  testing: 'Testing',
  crosslister: 'Crosslister / AI',
};

const CATEGORY_ORDER = [
  'framework', 'database', 'payments', 'shipping', 'search',
  'auth', 'email', 'ui', 'testing', 'crosslister',
];

export default async function IntegrationsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const deps = await getInstalledDependencies();

  // Group by category
  const grouped = new Map<string, typeof deps>();
  for (const dep of deps) {
    const existing = grouped.get(dep.category) ?? [];
    existing.push(dep);
    grouped.set(dep.category, existing);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Integrations & Dependencies"
        description="Current status of all third-party packages and platform integrations"
      />

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Integrations</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-primary">{deps.length}</p>
          <p className="text-xs text-gray-500">Tracked Dependencies</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {deps.filter((d) => d.currentVersion !== 'not installed').length}
          </p>
          <p className="text-xs text-gray-500">Installed</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-primary">{grouped.size}</p>
          <p className="text-xs text-gray-500">Categories</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">8</p>
          <p className="text-xs text-gray-500">Crosslister Connectors</p>
        </div>
      </div>

      {/* Connector Quick Links */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-primary">Crosslister Connectors</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { name: 'eBay', href: '/cfg/ebay', tier: 'A' },
            { name: 'Etsy', href: '/cfg/etsy', tier: 'A' },
            { name: 'Mercari', href: '/cfg/mercari', tier: 'B' },
            { name: 'Poshmark', href: '/cfg/poshmark', tier: 'C' },
            { name: 'Depop', href: '/cfg/depop', tier: 'B' },
            { name: 'Grailed', href: '/cfg/grailed', tier: 'B' },
            { name: 'FB Marketplace', href: '/cfg/fb-marketplace', tier: 'B' },
            { name: 'The RealReal', href: '/cfg/therealreal', tier: 'C' },
          ].map((c) => (
            <Link key={c.href} href={c.href}
              className="flex items-center justify-between rounded-md border border-gray-200 p-3 hover:bg-gray-50 transition-colors">
              <span className="text-sm font-medium text-primary">{c.name}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                Tier {c.tier}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Provider Quick Links */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-primary">Service Providers</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { name: 'Stripe', href: '/cfg/stripe', desc: 'Payments' },
            { name: 'Shippo', href: '/cfg/shippo', desc: 'Shipping' },
          ].map((p) => (
            <Link key={p.href} href={p.href}
              className="flex items-center justify-between rounded-md border border-gray-200 p-3 hover:bg-gray-50 transition-colors">
              <span className="text-sm font-medium text-primary">{p.name}</span>
              <span className="text-xs text-gray-500">{p.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Dependency Table by Category */}
      {CATEGORY_ORDER.map((cat) => {
        const catDeps = grouped.get(cat);
        if (!catDeps?.length) return null;
        return (
          <div key={cat} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-primary/5">
              <h3 className="text-sm font-semibold text-primary">{CATEGORY_LABELS[cat] ?? cat}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2 text-xs font-medium text-primary/70">Package</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-primary/70">Installed Version</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-primary/70">Status</th>
                </tr>
              </thead>
              <tbody>
                {catDeps.map((dep) => (
                  <tr key={dep.name} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5">
                      <code className="text-xs text-gray-800">{dep.name}</code>
                    </td>
                    <td className="px-5 py-2.5">
                      <code className="text-xs text-gray-600">{dep.currentVersion}</code>
                    </td>
                    <td className="px-5 py-2.5">
                      {dep.currentVersion !== 'not installed' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Installed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                          Not installed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
