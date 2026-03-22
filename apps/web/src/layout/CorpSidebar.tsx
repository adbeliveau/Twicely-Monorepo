"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { ADMIN_NAV, type AdminNavItem } from "@/lib/hub/admin-nav";
import { SIDEBAR_ICON_MAP } from "@/layout/sidebar-icons";

function getIcon(iconName: string) {
  return SIDEBAR_ICON_MAP[iconName] ?? SIDEBAR_ICON_MAP._default;
}

export default function CorpSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const showLabels = isExpanded || isHovered || isMobileOpen;

  const isActive = useCallback((href: string) => pathname === href, [pathname]);
  const isParentActive = useCallback(
    (item: AdminNavItem) => {
      if (pathname === item.href) return true;
      return item.children?.some((child) => pathname === child.href) ?? false;
    },
    [pathname]
  );

  const handleSubmenuClick = (item: AdminNavItem) => {
    if (openSubmenu === item.key) {
      setOpenSubmenu(null);
    } else {
      setOpenSubmenu(item.key);
      router.push(item.href);
    }
  };

  useEffect(() => {
    for (const item of ADMIN_NAV) {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => pathname === child.href);
        if (hasActiveChild) {
          setOpenSubmenu(item.key);
        }
      }
    }
  }, [pathname]);

  const renderNavItem = (item: AdminNavItem, isChild = false) => {
    const Icon = getIcon(item.icon);
    const active = isActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const isSubmenuOpen = openSubmenu === item.key;

    if (item.disabled) {
      return (
        <div key={item.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed">
          <Icon className="w-5 h-5 flex-shrink-0" />
          {showLabels && <span>{item.label}</span>}
        </div>
      );
    }

    if (hasChildren) {
      const parentActive = isParentActive(item);
      return (
        <div key={item.key}>
          <button
            onClick={() => handleSubmenuClick(item)}
            className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              parentActive
                ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {showLabels && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isSubmenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
          {isSubmenuOpen && showLabels && item.children && (
            <div className="mt-1 ml-4 space-y-1 border-l border-gray-200 dark:border-gray-700 pl-3">
              {item.children.map((child) => renderNavItem(child, true))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active
            ? "bg-brand-500 text-white"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        } ${isChild ? "py-2" : ""}`}
      >
        {!isChild && <Icon className="w-5 h-5 flex-shrink-0" />}
        {showLabels && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        isExpanded || isHovered ? "w-[290px]" : "w-[90px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="flex h-[72px] items-center justify-center border-b border-gray-200 px-4 dark:border-gray-800">
        <Link href="/d" className="flex items-center gap-2">
          {showLabels ? (
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Twicely <span className="text-brand-500">Hub</span>
            </span>
          ) : (
            <span className="text-xl font-bold text-brand-500">T</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          {ADMIN_NAV.map((item) => renderNavItem(item))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        {showLabels && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Twicely Hub Admin v3.0
          </div>
        )}
      </div>
    </aside>
  );
}
