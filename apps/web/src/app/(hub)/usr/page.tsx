// NAV_ENTRY: { label: 'Users', href: '/usr', icon: 'Users', roles: ['ADMIN', 'SUPPORT'] }

import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminUserList } from '@/lib/queries/admin-users';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Users | Twicely Hub' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'User')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const { users, total } = await getAdminUserList({
    page,
    pageSize: 50,
    search: params.search,
    status: params.status as 'active' | 'banned' | undefined,
  });

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description={`${total} users total`}
        actions={
          <div className="flex gap-2">
            <Link href="/usr/sellers" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              Sellers
            </Link>
            {ability.can('create', 'User') && (
              <Link href="/usr/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
                Create user
              </Link>
            )}
          </div>
        }
      />

      <form className="flex gap-2" method="get">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Search by name, email, or username..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          name="status"
          defaultValue={params.status}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Name</th>
              <th className="px-4 py-3 font-medium text-primary/70">Email</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Joined</th>
              <th className="px-4 py-3 font-medium text-primary/70">Orders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/usr/${u.id}`} className="font-medium text-primary hover:text-primary/80">
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${u.isSeller ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                    {u.isSeller ? 'Seller' : 'Buyer'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${u.isBanned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {u.isBanned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-600">{u.orderCount}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/usr?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/usr?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>}
        </div>
      )}
    </div>
  );
}
