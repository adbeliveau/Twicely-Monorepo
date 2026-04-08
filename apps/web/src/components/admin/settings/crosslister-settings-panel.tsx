/**
 * Crosslister settings panel — surfaces every `crosslister.*` platform setting
 * grouped by sub-namespace (polling, scheduler, queue, publishes, automation, …)
 * with inline edit support.
 *
 * Used by /cfg/crosslister/page.tsx to give operators a single place to view
 * and edit every crosslister.* setting.
 *
 * Source: 2026-04-07 owner directive — "make sure in the platform settings
 * there is a crosslister section with all the crosslister settings"
 */

import { SettingField } from '@/components/admin/settings/setting-field';
import type { SettingRow } from '@/lib/queries/admin-settings';

interface CrosslisterSettingsPanelProps {
  settings: SettingRow[];
  canEdit: boolean;
}

interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  /** Predicate that decides whether a setting belongs in this group. */
  match: (key: string) => boolean;
}

/**
 * Display order for the groups. Each group has a predicate that classifies
 * a `crosslister.*` key. The first matching group wins (top-to-bottom).
 *
 * Adding a new group: insert before "other" so its predicate is evaluated first.
 */
const GROUPS: SettingsGroup[] = [
  {
    id: 'polling',
    title: 'Polling Engine',
    description: 'Adaptive polling intervals, batch sizes, budgets, demotion thresholds, and webhook-primary channels.',
    match: (k) => k.startsWith('crosslister.polling.'),
  },
  {
    id: 'scheduler',
    title: 'Scheduler Loop',
    description: 'Dispatch loop tick interval and batch pull size for the gates pipeline (rate limit / fairness / circuit breaker).',
    match: (k) => k.startsWith('crosslister.scheduler.'),
  },
  {
    id: 'queue',
    title: 'BullMQ Queue',
    description: 'Job priorities, retry attempts, exponential backoff delays, retention, and worker concurrency.',
    match: (k) => k.startsWith('crosslister.queue.'),
  },
  {
    id: 'publishes',
    title: 'Publish Limits & Credits',
    description: 'Per-tier monthly publish allowances and rollover credit policy.',
    match: (k) =>
      k.startsWith('crosslister.publishes.') ||
      k.startsWith('crosslister.publishLimit.') ||
      k.startsWith('crosslister.rollover'),
  },
  {
    id: 'automation',
    title: 'Automation',
    description: 'Auto-relist, price drop, offer-to-likers, Posh share/follow rates and limits.',
    match: (k) => k.startsWith('crosslister.automation.') || k.startsWith('automation.'),
  },
  {
    id: 'circuit-breaker',
    title: 'Circuit Breaker',
    description: 'Failure thresholds and recovery windows for the per-platform circuit breaker.',
    match: (k) => k.startsWith('crosslister.circuitBreaker.') || k.startsWith('crosslister.cb.'),
  },
  {
    id: 'channel',
    title: 'Channel & Connector',
    description: 'Per-channel feature flags and connector behavior.',
    match: (k) => k.startsWith('crosslister.channel.') || k.startsWith('crosslister.connector.'),
  },
  {
    id: 'other',
    title: 'Other Crosslister Settings',
    description: 'Crosslister settings that do not fit a named group above.',
    match: (k) => k.startsWith('crosslister.'),
  },
];

function classify(key: string): string {
  for (const group of GROUPS) {
    if (group.match(key)) return group.id;
  }
  return 'other';
}

export function CrosslisterSettingsPanel({ settings, canEdit }: CrosslisterSettingsPanelProps) {
  const grouped = new Map<string, SettingRow[]>();
  for (const group of GROUPS) {
    grouped.set(group.id, []);
  }

  for (const setting of settings) {
    const groupId = classify(setting.key);
    const list = grouped.get(groupId) ?? [];
    list.push(setting);
    grouped.set(groupId, list);
  }

  // Sort within each group by key
  for (const list of grouped.values()) {
    list.sort((a, b) => a.key.localeCompare(b.key));
  }

  const totalSettings = settings.length;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Crosslister Settings
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Every <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">crosslister.*</code>{' '}
          platform setting. {totalSettings} total. Edit any value inline — changes
          take effect immediately for new requests; loops and worker concurrency
          require a worker restart.
        </p>
      </header>

      {GROUPS.map((group) => {
        const groupSettings = grouped.get(group.id) ?? [];
        if (groupSettings.length === 0) return null;
        return (
          <div
            key={group.id}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {group.title}{' '}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({groupSettings.length})
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {group.description}
              </p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {groupSettings.map((setting) => (
                <SettingField
                  key={setting.id}
                  settingId={setting.id}
                  settingKey={setting.key}
                  value={setting.value}
                  type={setting.type}
                  description={setting.description}
                  isSecret={setting.isSecret}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        );
      })}

      {totalSettings === 0 && (
        <p className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
          No crosslister.* settings found in platform_settings. Re-run the seed
          (<code>pnpm db:seed</code>) or check that v32-platform-settings.ts is
          loaded.
        </p>
      )}
    </section>
  );
}
