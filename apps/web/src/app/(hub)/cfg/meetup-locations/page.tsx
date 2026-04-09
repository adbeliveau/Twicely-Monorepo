import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getMeetupLocations } from '@/lib/queries/admin-meetup-locations';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { MeetupLocationsTab } from '@/components/hub/settings/meetup-locations-tab';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Meetup Locations | Twicely Hub' };

export default async function MeetupLocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; city?: string; state?: string; page?: string; search?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));

  const { total: paginatedTotal } = await getMeetupLocations({
    page,
    pageSize: 50,
    search: params.search,
    activeOnly: false,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Safe Meetup Locations"
        description={`${paginatedTotal} location${paginatedTotal === 1 ? '' : 's'} — Create and manage safe meetup locations for local sales`}
        actions={
          <Link
            href="/cfg"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Settings
          </Link>
        }
      />

      <MeetupLocationsTab
        canEdit={canEdit}
        filters={{
          type: params.type,
          city: params.city,
          state: params.state,
        }}
      />
    </div>
  );
}
