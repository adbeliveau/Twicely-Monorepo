import {
  getAllMeetupLocationsAdmin,
  getMeetupLocationStatsAdmin,
} from '@/lib/queries/admin-meetup-locations';
import { MeetupLocationsTable } from './meetup-locations-table';

interface MeetupLocationsTabProps {
  canEdit: boolean;
  filters?: {
    type?: string;
    city?: string;
    state?: string;
  };
}

export async function MeetupLocationsTab({
  canEdit,
  filters,
}: MeetupLocationsTabProps) {
  const [locations, stats] = await Promise.all([
    getAllMeetupLocationsAdmin(filters),
    getMeetupLocationStatsAdmin(),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-semibold text-green-700">{stats.active}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-semibold text-blue-700">{stats.verified}</p>
          <p className="text-xs text-gray-500">Verified</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-semibold text-gray-700">{stats.totalMeetups}</p>
          <p className="text-xs text-gray-500">Total Meetups</p>
        </div>
      </div>

      <MeetupLocationsTable locations={locations} canEdit={canEdit} filters={filters} />
    </div>
  );
}
