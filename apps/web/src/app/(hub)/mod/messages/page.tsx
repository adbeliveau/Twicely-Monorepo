import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { getFlaggedConversations } from '@/lib/queries/messaging-admin';
import { getMessageFlagPatterns } from '@/lib/queries/admin-moderation';
import { FlaggedMessagesTable } from '@/components/admin/flagged-messages-table';

export const metadata: Metadata = { title: 'Flagged Messages | Twicely Hub' };

export default async function FlaggedMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Message')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const keyword = params.q?.trim() ?? '';

  const [allRows, patterns] = await Promise.all([
    getFlaggedConversations(),
    getMessageFlagPatterns(),
  ]);

  // Client-side keyword filter on flagReason (message body not available in current query shape)
  const rows = keyword
    ? allRows.filter(
        (r) =>
          r.flagReason?.toLowerCase().includes(keyword.toLowerCase()) ||
          r.subject?.toLowerCase().includes(keyword.toLowerCase())
      )
    : allRows;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Flagged Messages"
        description={`${rows.length} flagged conversation${rows.length === 1 ? '' : 's'}`}
      />

      {/* Flag pattern summary */}
      {patterns.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-2">Top Report Reasons (last 30 days)</h3>
          <div className="flex flex-wrap gap-2">
            {patterns.map((p) => (
              <span key={p.reason} className="rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                {p.reason.replace(/_/g, ' ')}: <strong>{p.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Keyword search */}
      <form method="GET" action="/mod/messages" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={keyword}
          placeholder="Search by flag reason or subject..."
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Search
        </button>
        {keyword && (
          <a
            href="/mod/messages"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </a>
        )}
      </form>

      <FlaggedMessagesTable rows={rows} />
    </div>
  );
}
