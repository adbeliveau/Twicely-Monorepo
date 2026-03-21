import { formatDate } from '@twicely/utils/format';
import type { FlaggedConversationRow } from '@/lib/queries/messaging-admin';

interface FlaggedMessagesTableProps {
  rows: FlaggedConversationRow[];
}

export function FlaggedMessagesTable({ rows }: FlaggedMessagesTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">No flagged conversations.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Subject</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Buyer</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Seller</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Flag Reason</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Last Message</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">
                {row.subject ?? '(no subject)'}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.buyerName}</td>
              <td className="px-4 py-3 text-gray-700">{row.sellerName}</td>
              <td className="px-4 py-3 text-gray-500 max-w-[240px] truncate">
                {row.flagReason ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {row.lastMessageAt ? formatDate(row.lastMessageAt, 'short') : '—'}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-gray-400 italic">
                  Full moderation tooling available in Phase G
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
