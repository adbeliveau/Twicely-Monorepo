import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAllTeamsWithMembers } from '@/lib/queries/helpdesk-teams';
import { TeamList } from './team-list';
import { Users } from 'lucide-react';

export const metadata: Metadata = { title: 'Teams | Twicely Hub' };

export default async function HelpdeskTeamsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_MANAGER role required.</p>;
  }

  const teams = await getAllTeamsWithMembers();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-gray-500" />
        <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
      </div>
      <TeamList teams={teams} />
    </div>
  );
}
