import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl/authorize';
import { getCasesByRequester } from '@/lib/queries/helpdesk-cases';
import { MessageCircle, Plus } from 'lucide-react';
import { formatDate } from '@twicely/utils/format';

export const metadata: Metadata = { title: 'My Support Cases | Twicely' };

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Received',
  OPEN: 'In Progress',
  PENDING_USER: 'Awaiting Your Reply',
  PENDING_INTERNAL: 'In Progress',
  ON_HOLD: 'On Hold',
  ESCALATED: 'Under Review',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  OPEN: 'bg-green-100 text-green-800',
  PENDING_USER: 'bg-amber-100 text-amber-800',
  PENDING_INTERNAL: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-gray-100 text-gray-700',
  ESCALATED: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-slate-100 text-slate-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

export default async function MySupportPage() {
  const { session } = await authorize();
  if (!session) redirect('/auth/login');

  const cases = await getCasesByRequester(session.userId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Cases</h1>
          <p className="mt-1 text-sm text-gray-500">Track your support requests with Twicely</p>
        </div>
        <Link
          href="/h/contact"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No support cases yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Need help?{' '}
            <Link href="/h/contact" className="text-blue-600 hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Case
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Last Update
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/my/support/${c.id}`}
                      className="font-mono text-sm font-medium text-blue-600 hover:underline"
                    >
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/my/support/${c.id}`} className="text-sm text-gray-900 hover:text-blue-600">
                      {c.subject.length > 60 ? `${c.subject.slice(0, 60)}\u2026` : c.subject}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(c.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
