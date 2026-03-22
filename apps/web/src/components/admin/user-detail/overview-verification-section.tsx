import type { UserDetailFull } from '@/lib/queries/admin-users';

function dt(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

interface Props {
  user: UserDetailFull;
}

export function OverviewVerificationSection({ user: u }: Props) {
  if (!u.seller) return null;

  // Build verification display data from seller profile
  const verifications: Array<{
    type: string;
    status: string;
    date: string;
  }> = [];

  if (u.seller.verifiedAt) {
    verifications.push({
      type: 'IDENTITY',
      status: 'APPROVED',
      date: dt(u.seller.verifiedAt),
    });
  }

  // If no verification data at all, show placeholder
  if (verifications.length === 0) {
    return (
      <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Seller Verification</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Identity and business verification requests
          </p>
        </div>
        <div className="p-6">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            No verification records
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white">Seller Verification</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Identity and business verification requests
        </p>
      </div>
      <div className="p-6">
        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {verifications.map((v) => (
            <div key={v.type} className="flex flex-col rounded-lg border border-gray-200 p-4 dark:border-gray-600">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-gray-900 dark:text-white">
                  {v.type}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  v.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                  v.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                  v.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                  'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                }`}>
                  {v.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{v.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
