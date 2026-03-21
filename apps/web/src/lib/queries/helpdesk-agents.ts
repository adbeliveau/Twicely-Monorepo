import { db } from '@twicely/db';
import { staffUser, helpdeskTeam, helpdeskTeamMember } from '@twicely/db/schema';
import { eq, asc } from 'drizzle-orm';

export interface HelpdeskAgent {
  id: string;
  name: string;
}

export interface HelpdeskTeamItem {
  id: string;
  name: string;
}

export interface AgentsAndTeams {
  agents: HelpdeskAgent[];
  teams: HelpdeskTeamItem[];
}

/**
 * Returns all active staff agents and all helpdesk teams.
 * Used to populate assignment dropdowns in the case workspace.
 * Per install prompt §2.2: do NOT filter by team membership or availability.
 */
export async function getHelpdeskAgentsAndTeams(): Promise<AgentsAndTeams> {
  const [agentRows, teamRows] = await Promise.all([
    db
      .select({ id: staffUser.id, name: staffUser.displayName })
      .from(staffUser)
      .where(eq(staffUser.isActive, true))
      .orderBy(asc(staffUser.displayName)),
    db
      .select({ id: helpdeskTeam.id, name: helpdeskTeam.name })
      .from(helpdeskTeam)
      .orderBy(asc(helpdeskTeam.name)),
  ]);

  return {
    agents: agentRows,
    teams: teamRows,
  };
}

/**
 * Returns the persisted online/away status for an agent.
 * Reads isAvailable from any of their team memberships.
 * If the agent has no team memberships, returns true (default online).
 */
export async function getAgentOnlineStatus(staffUserId: string): Promise<boolean> {
  const rows = await db
    .select({ isAvailable: helpdeskTeamMember.isAvailable })
    .from(helpdeskTeamMember)
    .where(eq(helpdeskTeamMember.staffUserId, staffUserId))
    .limit(1);

  if (rows.length === 0) return true;
  return rows[0]?.isAvailable ?? true;
}
