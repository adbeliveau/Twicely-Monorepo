import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorizeOrRedirect } from '@/lib/casl/staff-authorize';
import { getResolvedCases } from '@/lib/queries/helpdesk-cases';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { RetentionBadge } from '@/components/helpdesk/retention-badge';
import { PriorityBadge, TypeBadge } from '@/components/helpdesk/helpdesk-badges';
import type { Priority, CaseType } from '@/components/helpdesk/helpdesk-badges';

const KNOWN_CASE_TYPES: CaseType[] = ['SUPPORT', 'DISPUTE', 'RETURN', 'CHARGEBACK', 'MODERATION', 'ACCOUNT'];
const KNOWN_PRIORITIES: Priority[] = ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'];

function isCaseType(t: string): t is CaseType { return (KNOWN_CASE_TYPES as string[]).includes(t); }
function isPriority(p: string): p is Priority { return (KNOWN_PRIORITIES as string[]).includes(p); }

export const metadata: Metadata = { title: 'Resolved Cases | Twicely Hub' };

type Props = { searchParams: Promise<{ tab?: string }> };

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
}

export default async function ResolvedCasesPage({ searchParams }: Props) {
  const { ability } = await staffAuthorizeOrRedirect();

  if (!ability.can('read', 'HelpdeskCase')) {
    return <p className="p-6 text-sm text-red-600">Access denied. Helpdesk role required.</p>;
  }

  const sp = await searchParams;
  const tab = sp.tab === 'closed' ? 'closed' : 'resolved';

  const [cases, retentionDays, autoCloseDays] = await Promise.all([
    getResolvedCases(tab, 100),
    getPlatformSetting<number>('helpdesk.retentionDays', 365),
    getPlatformSetting<number>('helpdesk.autoClose.resolvedDays', 7),
  ]);

  const tabClass = (active: boolean) =>
    active
      ? 'px-4 py-2 text-sm font-medium border-b-2 border-brand-500 text-brand-500'
      : 'px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200';

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'rgb(var(--hd-text-primary))' }}>
          Resolved Cases
        </h1>
        <p className="text-sm" style={{ color: 'rgb(var(--hd-text-muted))' }}>
          Archive of resolved and closed cases. CLOSED cases are permanently deleted after {retentionDays} days.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'rgb(var(--hd-border))' }}>
        <Link href="/hd/resolved?tab=resolved" className={tabClass(tab === 'resolved')}>
          Resolved
        </Link>
        <Link href="/hd/resolved?tab=closed" className={tabClass(tab === 'closed')}>
          Closed
        </Link>
      </div>

      {/* Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ background: 'rgb(var(--hd-bg-panel))', borderColor: 'rgb(var(--hd-border))' }}
      >
        {cases.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p style={{ color: 'rgb(var(--hd-text-muted))' }}>No {tab} cases found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs font-medium uppercase tracking-wider border-b"
                style={{ color: 'rgb(var(--hd-text-dim))', borderColor: 'rgb(var(--hd-border))', background: 'rgb(var(--hd-bg-card))' }}
              >
                <th className="px-4 py-3">Case #</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">{tab === 'resolved' ? 'Resolved' : 'Closed'}</th>
                <th className="px-4 py-3">Retention</th>
                <th className="px-4 py-3">Requester</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-b hover:bg-slate-800/20 transition-colors"
                  style={{ borderColor: 'rgb(var(--hd-border))' }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/hd/cases/${c.id}`}
                      className="font-mono text-xs text-brand-400 hover:underline"
                    >
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link
                      href={`/hd/cases/${c.id}`}
                      className="truncate block hover:underline"
                      style={{ color: 'rgb(var(--hd-text-primary))' }}
                    >
                      {c.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {isCaseType(c.type) ? (
                      <TypeBadge type={c.type} />
                    ) : (
                      <span className="text-xs text-slate-400">{c.type}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isPriority(c.priority) ? (
                      <PriorityBadge priority={c.priority} />
                    ) : (
                      <span className="text-xs text-slate-400">{c.priority}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--hd-text-secondary))' }}>
                    {tab === 'resolved' ? formatDate(c.resolvedAt) : formatDate(c.closedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <RetentionBadge
                      closedAt={c.closedAt}
                      resolvedAt={c.resolvedAt}
                      retentionDays={retentionDays}
                      autoCloseDays={autoCloseDays}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--hd-text-muted))' }}>
                    {c.requesterEmail ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
