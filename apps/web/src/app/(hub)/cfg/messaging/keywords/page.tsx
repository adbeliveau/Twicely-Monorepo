import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { KeywordManagement } from '@/components/admin/settings/keyword-management';

export const metadata: Metadata = { title: 'Banned Keywords | Twicely Hub' };

export default async function KeywordsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Messaging Keywords</span>
      </div>

      <AdminPageHeader
        title="Banned Keywords"
        description="Manage auto-flagging and blocking keywords for messaging"
      />

      <KeywordManagement canEdit={canEdit} />
    </div>
  );
}
