import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminUserDetail } from '@/lib/queries/admin-users';
import { AdminEditUserForm } from '@/components/admin/user-detail/admin-edit-user-form';

export const metadata: Metadata = { title: 'Edit User | Twicely Hub' };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'User')) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const userDetail = await getAdminUserDetail(id);
  if (!userDetail) notFound();

  return (
    <div className="p-6">
      <Link
        href={`/usr/${id}`}
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to User
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Edit User: {userDetail.name}
      </h1>

      <AdminEditUserForm
        userId={id}
        name={userDetail.name}
        displayName={userDetail.displayName}
        username={userDetail.username}
        email={userDetail.email}
        phone={userDetail.phone}
        marketingOptIn={userDetail.marketingOptIn}
      />
    </div>
  );
}
