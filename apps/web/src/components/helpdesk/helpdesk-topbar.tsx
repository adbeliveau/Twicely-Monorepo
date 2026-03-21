"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, Bell, HelpCircle, Menu, ArrowLeft } from "lucide-react";
import { KeyboardShortcutsModal } from "./helpdesk-topbar-extras";

export { TabBar } from "./helpdesk-topbar-extras";

// =============================================================================
// TYPES
// =============================================================================

interface HdNotification {
  id: string;
  title: string;
  body: string;
  caseId?: string;
  createdAt: string;
  read: boolean;
}

interface HelpdeskTopbarProps {
  title: string;
  subtitle?: string;
  showBackToAdmin?: boolean;
  isSidebarHidden?: boolean;
  onToggleSidebar?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

// =============================================================================
// HELPDESK TOPBAR
// =============================================================================

export function HelpdeskTopbar({
  title, subtitle, showBackToAdmin = false, isSidebarHidden = false,
  onToggleSidebar, actions, className,
}: HelpdeskTopbarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [notifications] = useState<HdNotification[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === "Escape") { setShowNotifications(false); setShowShortcuts(false); searchInputRef.current?.blur(); }
      if (e.key === "?" && document.activeElement !== searchInputRef.current) { setShowShortcuts(true); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/hd/cases?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header
      className={cn("flex items-center justify-between h-14 px-4 border-b", className)}
      style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        {isSidebarHidden && (
          <button onClick={onToggleSidebar} className="p-2 rounded-md hd-transition" style={{ color: "rgb(var(--hd-text-muted))" }} title="Toggle sidebar">
            <Menu className="w-5 h-5" />
          </button>
        )}
        {showBackToAdmin && (
          <Link href="/d" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hd-transition" style={{ color: "rgb(var(--hd-text-muted))" }}>
            <ArrowLeft className="w-4 h-4" /><span>Back to Admin</span>
          </Link>
        )}
        <div>
          <h1 className="text-lg font-bold" style={{ color: "rgb(var(--hd-text-primary))" }}>{title}</h1>
          {subtitle && <p className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{subtitle}</p>}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {actions}

        {/* Search */}
        <form onSubmit={handleSearch}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 hd-transition min-w-[240px]"
            style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))" }}
          >
            <Search className="w-4 h-4" style={{ color: "rgb(var(--hd-text-dim))" }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "rgb(var(--hd-text-primary))" }}
            />
            <kbd className="hd-kbd">⌘K</kbd>
          </div>
        </form>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-md hd-transition" style={{ color: "rgb(var(--hd-text-muted))" }}>
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <NotificationsDropdown
              notifications={notifications}
              onNavigate={(caseId) => { if (caseId) router.push(`/hd/cases/${caseId}`); setShowNotifications(false); }}
              formatTimeAgo={formatTimeAgo}
            />
          )}
        </div>

        {/* Shortcuts */}
        <button onClick={() => setShowShortcuts(true)} className="p-2 rounded-md hd-transition" style={{ color: "rgb(var(--hd-text-muted))" }} title="Keyboard shortcuts">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </header>
  );
}

// =============================================================================
// NOTIFICATIONS DROPDOWN
// =============================================================================

function NotificationsDropdown({
  notifications,
  onNavigate,
  formatTimeAgo,
}: {
  notifications: HdNotification[];
  onNavigate: (caseId?: string) => void;
  formatTimeAgo: (d: string) => string;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-xl z-50 border"
      style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "rgb(var(--hd-border))" }}>
        <h3 className="font-semibold" style={{ color: "rgb(var(--hd-text-primary))" }}>Notifications</h3>
        {unreadCount > 0 && <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{unreadCount} unread</span>}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center" style={{ color: "rgb(var(--hd-text-muted))" }}>
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn("p-2 rounded-md cursor-pointer", !n.read && "bg-blue-500/10")}
                onClick={() => onNavigate(n.caseId)}
              >
                <p className="text-sm font-medium" style={{ color: "rgb(var(--hd-text-primary))" }}>{n.title}</p>
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "rgb(var(--hd-text-muted))" }}>{n.body}</p>
                <p className="text-xs mt-1" style={{ color: "rgb(var(--hd-text-dim))" }}>{formatTimeAgo(n.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
