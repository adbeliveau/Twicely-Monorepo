import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTypesenseCollections } from '@/lib/queries/admin-search';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SearchAdminPanel } from '@/components/admin/search-admin-panel';

export const metadata: Metadata = {
  title: 'Search Admin | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function SearchAdminPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canRebuild = ability.can('manage', 'Setting');
  const status = await getTypesenseCollections();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Search Admin"
        description="Typesense connection status and collection management."
      />
      <SearchAdminPanel status={status} canRebuild={canRebuild} />
    </div>
  );
}
