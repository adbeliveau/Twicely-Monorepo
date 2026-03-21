import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CreateStaffForm } from '@/components/admin/create-staff-form';

export const metadata: Metadata = { title: 'Add Staff | Twicely Hub' };

export default async function AddStaffPage() {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'StaffUser')) {
    return <p className="text-red-600">Access denied</p>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Add Staff Member"
        description="Create a new staff user account with system roles"
        actions={
          <Link
            href="/roles/staff"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Staff
          </Link>
        }
      />
      <CreateStaffForm viewerRoles={session.platformRoles} />
    </div>
  );
}
