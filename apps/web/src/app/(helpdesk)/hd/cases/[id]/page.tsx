import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffAuthorize } from "@/lib/casl/staff-authorize";
import { getAgentCaseDetail, getAgentCaseQueue, getCaseWatchers } from "@/lib/queries/helpdesk-cases";
import { getCaseContext } from "@/lib/queries/helpdesk-context";
import { getAgentMacros } from "@/lib/queries/helpdesk-macros";
import { getHelpdeskAgentsAndTeams } from "@/lib/queries/helpdesk-agents";
import { CaseWorkspace } from "./case-workspace";
import type { CaseContextData } from "@/components/helpdesk/context-panel";

export const metadata: Metadata = { title: "Case Detail | Twicely Hub" };

type Props = { params: Promise<{ id: string }> };

export default async function AgentCaseDetailPage({ params }: Props) {
  const { id } = await params;
  const { ability, session } = await staffAuthorize();

  if (!ability.can("read", "HelpdeskCase")) {
    return <p className="p-6 text-sm text-red-600">Access denied</p>;
  }

  const [caseDetail, caseQueue, macros, agentsAndTeams] = await Promise.all([
    getAgentCaseDetail(id),
    getAgentCaseQueue({ assignedAgentId: session.staffUserId }),
    getAgentMacros(),
    getHelpdeskAgentsAndTeams(),
  ]);

  const watchers = caseDetail ? await getCaseWatchers(id) : [];

  if (!caseDetail) notFound();

  let contextData: CaseContextData;
  try {
    contextData = await getCaseContext(caseDetail);
  } catch {
    contextData = {
      tags: [],
      requesterName: undefined,
      requesterEmail: undefined,
    };
  }

  return (
    <CaseWorkspace
      caseDetail={caseDetail}
      caseQueue={caseQueue}
      contextData={contextData}
      macros={macros}
      agentsAndTeams={agentsAndTeams}
      agentName={session.displayName}
      agentStaffUserId={session.staffUserId}
      watchers={watchers}
    />
  );
}
