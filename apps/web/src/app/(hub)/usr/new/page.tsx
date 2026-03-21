// NAV_ENTRY: { label: 'Create User', href: '/usr/new', roles: ['ADMIN'] }

import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CreateUserForm } from '@/components/admin/user-detail/create-user-form';

export const metadata: Metadata = { title: 'Create User | Twicely Hub' };

export default async function CreateUserPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'User')) {
    return <p className="text-red-600">Access denied</p>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Create User"
        description="Create a new user account. The user will receive a password-reset email to set their password."
      />
      <div className="max-w-lg">
        <CreateUserForm />
      </div>
    </div>
  );
}
