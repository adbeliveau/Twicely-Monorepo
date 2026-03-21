import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CollectionForm } from '@/components/admin/collections/collection-form';

export const metadata: Metadata = { title: 'Create Collection | Twicely Hub' };

export default async function CreateCollectionPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'CuratedCollection')) {
    return <p className="text-red-600">Access denied</p>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Create Collection" />
      <div className="max-w-2xl">
        <CollectionForm mode="create" />
      </div>
    </div>
  );
}
