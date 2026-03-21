// NAV_ENTRY: { label: 'Verification Queue', href: '/usr/sellers/verification', roles: ['ADMIN'] }

import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminVerificationQueue } from '@/lib/queries/admin-sellers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Verification Queue | Twicely Hub' };

export default async function VerificationQueuePage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'User') || !ability.can('update', 'SellerProfile')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const sellers = await getAdminVerificationQueue();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Verification Queue"
        description="Sellers requiring identity verification or under enforcement review"
      />

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        This is a read-only queue. Full KYC approve/reject flow will be available when the verification system is activated.
        Actions on these sellers can be taken from their individual detail pages.
      </div>

      <p className="text-sm text-gray-500">{sellers.length} seller(s) pending</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-3 py-3 font-medium text-primary/70">Type</th>
              <th className="px-3 py-3 font-medium text-primary/70">Store Tier</th>
              <th className="px-3 py-3 font-medium text-primary/70">Verified</th>
              <th className="px-3 py-3 font-medium text-primary/70">Enforcement</th>
              <th className="px-3 py-3 font-medium text-primary/70">Status</th>
              <th className="px-3 py-3 font-medium text-primary/70">Seller Since</th>
              <th className="px-3 py-3 font-medium text-primary/70">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sellers.map((s) => (
              <tr key={s.userId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{s.name}</span>
                  <div className="text-xs text-gray-400">{s.email}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${s.sellerType === 'BUSINESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.sellerType}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs">{s.storeTier}</td>
                <td className="px-3 py-3">
                  {s.verifiedAt ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                      Verified {s.verifiedAt.toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
                      Unverified
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {s.enforcementLevel ? (
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                      {s.enforcementLevel}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    s.status === 'RESTRICTED' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{s.status}</span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">{s.activatedAt?.toLocaleDateString() ?? '—'}</td>
                <td className="px-3 py-3">
                  <Link href={`/usr/${s.userId}`} className="text-primary hover:underline text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No sellers pending verification
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
