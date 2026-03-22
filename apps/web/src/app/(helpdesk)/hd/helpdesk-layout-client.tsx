"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HelpdeskSidebar } from "./helpdesk-sidebar";
import { HelpdeskTopbar } from "@/components/helpdesk/helpdesk-topbar";
import { toggleAgentOnlineStatus } from "@/lib/actions/helpdesk-agent";

interface HelpdeskBadges {
  allCases: number;
  myOpen: number;
  unassigned: number;
  emailInbox: number;
  slaBreach: number;
  pending: number;
  escalated: number;
}

interface HelpdeskLayoutClientProps {
  children: React.ReactNode;
  agentName: string;
  permissions: string[];
  canAccessAdmin?: boolean;
  badges?: HelpdeskBadges;
  initialIsOnline?: boolean;
}

export function HelpdeskLayoutClient({
  children,
  agentName,
  permissions,
  canAccessAdmin = false,
  badges,
  initialIsOnline = true,
}: HelpdeskLayoutClientProps) {
  const pathname = usePathname();
  const isCaseDetail = /^\/hd\/cases\/[^/]+$/.test(pathname);

  const [isOnline, setIsOnline] = useState(initialIsOnline);
  const [sidebarHidden, setSidebarHidden] = useState(isCaseDetail);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-hide sidebar on case detail, show on other pages
  useEffect(() => {
    setSidebarHidden(isCaseDetail);
    setDrawerOpen(false);
  }, [isCaseDetail]);

  const handleToggleSidebar = () => {
    if (sidebarHidden) {
      setDrawerOpen((prev) => !prev);
    } else {
      setSidebarHidden(true);
    }
  };

  const handleToggleStatus = async (newIsOnline: boolean) => {
    setIsOnline(newIsOnline);
    await toggleAgentOnlineStatus({ isOnline: newIsOnline });
  };

  const agent = { name: agentName, isOnline, caseCount: badges?.myOpen ?? 0 };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "rgb(var(--hd-bg-deep))" }}>
      {/* Sidebar — visible when not hidden */}
      {!sidebarHidden && (
        <HelpdeskSidebar
          agent={agent}
          onToggleStatus={handleToggleStatus}
          permissions={permissions}
          badges={badges}
        />
      )}

      {/* Drawer overlay — when sidebar hidden and drawer toggled open */}
      {sidebarHidden && drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <div className={cn("fixed left-0 top-0 h-full z-50 transform transition-transform duration-200", drawerOpen ? "translate-x-0" : "-translate-x-full")}>
            <HelpdeskSidebar
              agent={agent}
              onToggleStatus={handleToggleStatus}
              permissions={permissions}
              badges={badges}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <HelpdeskTopbar
          title="Helpdesk"
          showBackToAdmin={canAccessAdmin}
          isSidebarHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
