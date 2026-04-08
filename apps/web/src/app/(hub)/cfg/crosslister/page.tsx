import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CrosslisterSettingsPanel } from '@/components/admin/settings/crosslister-settings-panel';
import { getConnectorStats } from '@/lib/queries/admin-connector-settings';
import { getSettingsByKeyPrefix } from '@/lib/queries/admin-settings';

export const metadata: Metadata = { title: 'Crosslister | Twicely Hub' };

const CONNECTORS = [
  { code: 'ebay',           name: 'eBay',           channel: 'EBAY',           href: '/cfg/ebay',           tier: 'A — Full OAuth' },
  { code: 'etsy',           name: 'Etsy',           channel: 'ETSY',           href: '/cfg/etsy',           tier: 'A — Full OAuth' },
  { code: 'mercari',        name: 'Mercari',        channel: 'MERCARI',        href: '/cfg/mercari',        tier: 'B — Partial' },
  { code: 'poshmark',       name: 'Poshmark',       channel: 'POSHMARK',       href: '/cfg/poshmark',       tier: 'B — Partial' },
  { code: 'depop',          name: 'Depop',          channel: 'DEPOP',          href: '/cfg/depop',          tier: 'B — Partial' },
  { code: 'grailed',        name: 'Grailed',        channel: 'GRAILED',        href: '/cfg/grailed',        tier: 'B — Partial' },
  { code: 'fb-marketplace', name: 'FB Marketplace', channel: 'FB_MARKETPLACE', href: '/cfg/fb-marketplace', tier: 'C — Extension' },
  { code: 'therealreal',    name: 'The RealReal',   channel: 'THEREALREAL',    href: '/cfg/therealreal',    tier: 'C — Extension' },
  { code: 'whatnot',        name: 'Whatnot',        channel: 'WHATNOT',        href: '/cfg/whatnot',        tier: 'C — Extension' },
  { code: 'shopify',        name: 'Shopify',        channel: 'SHOPIFY',        href: '/cfg/shopify',        tier: 'A — Full OAuth' },
  { code: 'vestiaire',      name: 'Vestiaire',      channel: 'VESTIAIRE',      href: '/cfg/vestiaire',      tier: 'C — Extension' },
] as const;

export default async function CrosslisterOverviewPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');

  const [stats, crosslisterSettings] = await Promise.all([
    Promise.all(CONNECTORS.map((c) => getConnectorStats(c.channel).catch(() => null))),
    getSettingsByKeyPrefix('crosslister.'),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Crosslister"
        description="Channel connectors and every crosslister.* platform setting (polling, scheduler, queue, publishes, automation)."
      />

      {/* ─── Connectors section ────────────────────────────────────────── */}
      <section className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Channel Connectors
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            All 11 crosslister channel connectors — click for OAuth setup, webhooks, and per-platform settings.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((connector, index) => {
            const stat = stats[index];
            return (
              <Link
                key={connector.code}
                href={connector.href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {connector.name}
                  </h3>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    Tier {connector.tier}
                  </span>
                </div>
                {stat ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-gray-500">Active accounts</dt>
                      <dd className="font-mono text-gray-900 dark:text-gray-100">
                        {stat.activeAccounts}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Connected accounts</dt>
                      <dd className="font-mono text-gray-900 dark:text-gray-100">
                        {stat.connectedAccounts}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 text-xs text-gray-400">No data</p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ─── Crosslister settings section (every crosslister.* key) ────── */}
      <CrosslisterSettingsPanel settings={crosslisterSettings} canEdit={canEdit} />
    </div>
  );
}
