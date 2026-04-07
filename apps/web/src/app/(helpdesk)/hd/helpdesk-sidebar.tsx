"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, List, User, Inbox, Mail, Clock, Hourglass,
  AlertTriangle, FolderOpen, Scale, Package, CreditCard, Shield,
  Users, Zap, GitBranch, Timer, Settings, BarChart2, Bot, Bookmark,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: "red" | "amber" | "blue" | "green" | "neutral";
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface AgentStatus {
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
  caseCount: number;
}

interface HelpdeskSidebarProps {
  agent: AgentStatus;
  onToggleStatus?: (isOnline: boolean) => void;
  badges?: {
    allCases?: number;
    myOpen?: number;
    unassigned?: number;
    emailInbox?: number;
    slaBreach?: number;
    pending?: number;
    escalated?: number;
  };
  permissions?: string[];
  className?: string;
}

export function HelpdeskSidebar({ agent, onToggleStatus, badges = {}, permissions = [], className }: HelpdeskSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const initials = agent.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const navigation: NavSection[] = [
    { title: "Overview", items: [{ label: "Dashboard", href: "/hd", icon: LayoutDashboard }] },
    {
      title: "Queues",
      items: [
        { label: "All Cases", href: "/hd/cases", icon: List, badge: badges.allCases },
        { label: "My Open", href: "/hd/cases?assignee=me&status=open", icon: User, badge: badges.myOpen, badgeColor: "blue" },
        { label: "Unassigned", href: "/hd/cases?assignee=unassigned", icon: Inbox, badge: badges.unassigned, badgeColor: "amber" },
        { label: "Email Inbox", href: "/hd/cases?channel=email", icon: Mail, badge: badges.emailInbox },
      ],
    },
    {
      title: "Views",
      items: [
        { label: "SLA Breaching", href: "/hd/cases?sla=breaching", icon: Clock, badge: badges.slaBreach, badgeColor: "red" },
        { label: "Pending", href: "/hd/cases?status=pending", icon: Hourglass, badge: badges.pending, badgeColor: "amber" },
        { label: "Escalated", href: "/hd/cases?status=escalated", icon: AlertTriangle, badge: badges.escalated, badgeColor: "red" },
      ],
    },
    { title: "Archive", items: [{ label: "Resolved Cases", href: "/hd/resolved", icon: FolderOpen }] },
    {
      title: "Types",
      items: [
        { label: "Disputes", href: "/hd/cases?type=dispute", icon: Scale },
        { label: "Returns", href: "/hd/cases?type=return", icon: Package },
        { label: "Chargebacks", href: "/hd/cases?type=chargeback", icon: CreditCard },
        { label: "Moderation", href: "/hd/cases?type=moderation", icon: Shield },
      ],
    },
    {
      title: "Manage",
      items: [
        { label: "Reports", href: "/hd/reports", icon: BarChart2, permission: "helpdesk.reports.view" },
        { label: "Teams", href: "/hd/teams", icon: Users, permission: "helpdesk.teams.view" },
        { label: "Macros", href: "/hd/macros", icon: Zap, permission: "helpdesk.macros.view" },
        { label: "Automation", href: "/hd/automation", icon: Bot, permission: "helpdesk.settings.manage" },
        { label: "Routing", href: "/hd/routing", icon: GitBranch, permission: "helpdesk.routing.manage" },
        { label: "Saved Views", href: "/hd/views", icon: Bookmark, permission: "helpdesk.settings.manage" },
        { label: "SLA Policies", href: "/hd/sla", icon: Timer, permission: "helpdesk.sla.manage" },
        { label: "Settings", href: "/hd/settings", icon: Settings, permission: "helpdesk.settings.manage" },
      ],
    },
  ];

  const badgeColors: Record<string, string> = {
    red: "bg-red-500/20 text-red-500",
    amber: "bg-amber-500/20 text-amber-500",
    blue: "bg-brand-500/20 text-brand-500",
    green: "bg-green-500/20 text-green-500",
    neutral: "bg-slate-500/20 text-slate-500",
  };

  const isActive = (href: string) => {
    if (href === "/hd/cases" && pathname === "/hd/cases") return searchParams.toString() === "";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    return permissions.includes(permission) || permissions.includes("*");
  };

  return (
    <aside
      className={cn("flex flex-col h-full border-r transition-all duration-200", isCollapsed ? "w-16" : "w-56", className)}
      style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "rgb(var(--hd-border))" }}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-sm flex-shrink-0"
        >
          T
        </button>
        {!isCollapsed && (
          <div>
            <div className="font-bold text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>Twicely</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "rgb(var(--hd-text-dim))" }}>Helpdesk</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 hd-scrollbar">
        {navigation.map((section) => (
          <div key={section.title} className="mb-2">
            {!isCollapsed && (
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgb(var(--hd-text-dim))" }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              if (!hasPermission(item.permission)) return null;
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded-md text-sm hd-transition", active && "hd-sidebar-item-active")}
                  style={active ? undefined : { color: "rgb(var(--hd-text-secondary))" }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={cn("px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[20px] text-center", badgeColors[item.badgeColor ?? "neutral"])}>
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Agent Status Footer */}
      <div className="p-3 border-t" style={{ borderColor: "rgb(var(--hd-border))" }}>
        <div className="flex items-center gap-3">
          {agent.avatarUrl ? (
            <img src={agent.avatarUrl} alt={agent.name} className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", agent.isOnline ? "bg-green-500/20 text-green-600" : "bg-slate-500/20 text-slate-500")}>
              {initials}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate" style={{ color: "rgb(var(--hd-text-primary))" }}>{agent.name}</div>
              <button
                onClick={() => onToggleStatus?.(!agent.isOnline)}
                className={cn("flex items-center gap-1.5 text-xs", agent.isOnline ? "text-green-600" : "text-slate-500")}
              >
                <span className={cn("w-2 h-2 rounded-full", agent.isOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-slate-400")} />
                <span>{agent.isOnline ? "Online" : "Offline"}</span>
                <span style={{ color: "rgb(var(--hd-text-dim))" }}>• {agent.caseCount} cases</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
