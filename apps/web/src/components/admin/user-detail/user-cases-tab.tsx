import Link from 'next/link';

interface CaseRow {
  id: string;
  requesterId: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
}

interface UserCasesTabProps {
  cases: CaseRow[];
}

function priorityColor(p: string): string {
  if (p === 'URGENT') return 'bg-red-100 text-red-700';
  if (p === 'HIGH') return 'bg-orange-100 text-orange-700';
  if (p === 'MEDIUM') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
}

function statusColor(s: string): string {
  if (s === 'OPEN') return 'bg-blue-100 text-blue-700';
  if (s === 'RESOLVED') return 'bg-green-100 text-green-700';
  if (s === 'CLOSED') return 'bg-gray-100 text-gray-600';
  return 'bg-yellow-100 text-yellow-700';
}

export function UserCasesTab({ cases }: UserCasesTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{cases.length} case(s)</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Case ID</th>
              <th className="px-4 py-3 font-medium text-primary/70">Subject</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Priority</th>
              <th className="px-4 py-3 font-medium text-primary/70">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/hd?case=${c.id}`} className="font-mono text-xs text-primary hover:underline">
                    {c.id.slice(0, 12)}…
                  </Link>
                </td>
                <td className="px-4 py-3">{c.subject}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorityColor(c.priority)}`}>{c.priority}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No support cases</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
