import { db } from '@twicely/db';
import { helpdeskTeam, helpdeskTeamMember } from '@twicely/db/schema';
import { desc, eq } from 'drizzle-orm';

export interface TeamWithMembers {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  maxConcurrentCases: number;
  roundRobinEnabled: boolean;
  memberCount: number;
}

export interface TeamMemberRow {
  id: string;
  staffUserId: string;
  isAvailable: boolean;
  activeCaseCount: number;
}

/** Get all teams with member counts for the teams management page */
export async function getAllTeamsWithMembers(): Promise<TeamWithMembers[]> {
  const teams = await db
    .select({
      id: helpdeskTeam.id,
      name: helpdeskTeam.name,
      description: helpdeskTeam.description,
      isDefault: helpdeskTeam.isDefault,
      maxConcurrentCases: helpdeskTeam.maxConcurrentCases,
      roundRobinEnabled: helpdeskTeam.roundRobinEnabled,
    })
    .from(helpdeskTeam)
    .orderBy(desc(helpdeskTeam.isDefault));

  const members = await db
    .select({
      teamId: helpdeskTeamMember.teamId,
    })
    .from(helpdeskTeamMember);

  const countByTeam = new Map<string, number>();
  for (const m of members) {
    countByTeam.set(m.teamId, (countByTeam.get(m.teamId) ?? 0) + 1);
  }

  return teams.map((t) => ({
    ...t,
    memberCount: countByTeam.get(t.id) ?? 0,
  }));
}

/** Get team members for a specific team */
export async function getTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
  return db
    .select({
      id: helpdeskTeamMember.id,
      staffUserId: helpdeskTeamMember.staffUserId,
      isAvailable: helpdeskTeamMember.isAvailable,
      activeCaseCount: helpdeskTeamMember.activeCaseCount,
    })
    .from(helpdeskTeamMember)
    .where(eq(helpdeskTeamMember.teamId, teamId));
}
