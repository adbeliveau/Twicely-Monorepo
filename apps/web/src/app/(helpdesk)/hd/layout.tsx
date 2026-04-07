import { staffAuthorizeOrRedirect } from "@/lib/casl/staff-authorize";
import { getHelpdeskBadges } from "@/lib/queries/helpdesk-badges";
import { getAgentOnlineStatus } from "@/lib/queries/helpdesk-agents";
import { HelpdeskLayoutClient } from "./helpdesk-layout-client";
import { SkipNav } from "@/components/shared/skip-nav";
import "./helpdesk-theme.css";

export default async function HelpdeskLayout({ children }: { children: React.ReactNode }) {
  const { ability, session } = await staffAuthorizeOrRedirect();

  if (!ability.can("read", "HelpdeskCase")) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Access denied. Helpdesk role required.</p>
      </div>
    );
  }

  const agentName = session.displayName ?? session.email;
  const canAccessAdmin = (session.platformRoles as string[]).some((r) =>
    ["ADMIN", "SUPER_ADMIN", "HELPDESK_MANAGER"].includes(r)
  );

  const [badges, initialIsOnline] = await Promise.all([
    getHelpdeskBadges(session.staffUserId),
    getAgentOnlineStatus(session.staffUserId),
  ]);

  return (
    <>
      <SkipNav />
      <HelpdeskLayoutClient
        agentName={agentName}
        permissions={session.platformRoles as string[]}
        canAccessAdmin={canAccessAdmin}
        badges={badges}
        initialIsOnline={initialIsOnline}
      >
        {children}
      </HelpdeskLayoutClient>
    </>
  );
}
