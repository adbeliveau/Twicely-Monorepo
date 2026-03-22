"use client";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import {
  BoxCubeIcon,
  CartIcon,
  ChatIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  MailIcon,
  PieChartIcon,
  PlugInIcon,
  UserCircleIcon,
} from "../icons/index";
import SidebarWidget from "./SidebarWidget";

// =============================================================================
// TYPES
// =============================================================================

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

type NavSubItemWithPermission = {
  name: string;
  path: string;
  permission?: string;
};

type NavItemWithPermission = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  permission?: string;
  subItems?: NavSubItemWithPermission[];
};

// =============================================================================
// PERMISSION-BASED FILTERING
// =============================================================================

/**
 * Filters menu items based on user permissions.
 * - If permission is undefined → everyone sees it
 * - If permission is set → only users with that permission see it
 * - Users with ["*"] see EVERYTHING
 */
function filterByPermissions(
  items: NavItemWithPermission[],
  userPermissions: string[]
): NavItem[] {
  const hasPermission = (p: string | undefined): boolean => {
    if (!p) return true; // No permission required
    if (userPermissions.includes("*")) return true; // Wildcard = all access
    return userPermissions.includes(p);
  };

  return items
    .filter((item) => hasPermission(item.permission))
    .map((item) => ({
      name: item.name,
      icon: item.icon,
      path: item.path,
      subItems: item.subItems?.filter((sub) => hasPermission(sub.permission)),
    }))
    .filter((item) => item.path || (item.subItems && item.subItems.length > 0));
}

// =============================================================================
// CORP MENU ITEMS (with permissions)
// =============================================================================

// Dashboard item (shown above section headers)
const CORP_DASHBOARD: NavItemWithPermission = {
  icon: <GridIcon />,
  name: "Dashboard",
  path: "/corp",
  // No permission - all staff see this
};

// Operations Management section - with nested submenus
const OPERATIONS_MENU_ITEMS: NavItemWithPermission[] = [
  {
    icon: <UserCircleIcon />,
    name: "Users & Sellers",
    permission: "users.view",
    subItems: [
      { name: "All Users", path: "/corp/users", permission: "users.view" },
      { name: "Verification", path: "/corp/sellers/verification", permission: "users.view" },
    ],
  },
  {
    icon: <CartIcon />,
    name: "Commerce",
    permission: "orders.view",
    subItems: [
      { name: "Orders", path: "/corp/orders", permission: "orders.view" },
      { name: "Listings", path: "/corp/listings", permission: "listings.view" },
      { name: "Categories", path: "/corp/categories", permission: "listings.view" },
      { name: "Reviews", path: "/corp/reviews", permission: "reviews.view" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Finance",
    permission: "ledger.view",
    subItems: [
      { name: "Overview", path: "/corp/finance", permission: "ledger.view" },
      { name: "Payouts", path: "/corp/finance/payouts", permission: "payouts.view" },
      { name: "Chargebacks", path: "/corp/finance/chargebacks", permission: "chargebacks.view" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Trust & Safety",
    permission: "cases.view",
    subItems: [
      { name: "Cases", path: "/corp/cases", permission: "cases.view" },
      { name: "Disputes", path: "/corp/disputes", permission: "disputes.view" },
      { name: "Returns", path: "/corp/returns", permission: "returns.view" },
      { name: "Trust Scores", path: "/corp/trust", permission: "cases.view" },
    ],
  },
  {
    icon: <MailIcon />,
    name: "Support",
    permission: "tickets.view",
    subItems: [
      { name: "Tickets", path: "/corp/tickets", permission: "tickets.view" },
      { name: "Messages", path: "/corp/messages", permission: "messages.view" },
    ],
  },
];

// Platform Management section - flat, no submenus
const PLATFORM_MENU_ITEMS: NavItemWithPermission[] = [
  { icon: <PlugInIcon />, name: "Health", path: "/corp/health", permission: "health.view" },
  { icon: <PlugInIcon />, name: "Doctor", path: "/corp/doctor", permission: "doctor.view" },
  { icon: <PieChartIcon />, name: "Ledger", path: "/corp/finance/ledger", permission: "ledger.view" },
  { icon: <PlugInIcon />, name: "Feature Flags", path: "/corp/flags", permission: "flags.view" },
  { icon: <PlugInIcon />, name: "Audit Log", path: "/corp/audit", permission: "audit.view" },
  { icon: <UserCircleIcon />, name: "Employees", path: "/corp/employees", permission: "employees.view" },
  { icon: <PlugInIcon />, name: "Roles", path: "/corp/roles", permission: "roles.view" },
  { icon: <PlugInIcon />, name: "Settings", path: "/corp/settings", permission: "settings.view" },
];

// =============================================================================
// SELLER NAVIGATION - /seller/* (static, no permission filtering)
// =============================================================================

const SELLER_NAV: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/seller",
  },
  {
    icon: <BoxCubeIcon />,
    name: "Listings",
    subItems: [
      { name: "All Listings", path: "/seller/listings" },
      { name: "Drafts", path: "/seller/listings?status=DRAFT" },
      { name: "Ended", path: "/seller/listings?status=ENDED" },
      { name: "Create Listing", path: "/seller/listings/new" },
    ],
  },
  {
    icon: <CartIcon />,
    name: "Orders",
    subItems: [
      { name: "To Ship", path: "/seller/orders?status=pending" },
      { name: "Shipped", path: "/seller/orders?status=shipped" },
      { name: "Completed", path: "/seller/orders?status=completed" },
      { name: "All Orders", path: "/seller/orders" },
    ],
  },
  {
    icon: <ChatIcon />,
    name: "Sales Tools",
    subItems: [
      { name: "Offers", path: "/seller/offers" },
      { name: "Bundles", path: "/seller/bundles" },
      { name: "Promotions", path: "/seller/promotions" },
      { name: "Coupons", path: "/seller/coupons" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Performance",
    subItems: [
      { name: "Analytics", path: "/seller/analytics" },
      { name: "Seller Level", path: "/seller/performance" },
      { name: "Trust Score", path: "/seller/trust" },
      { name: "Reviews", path: "/seller/reviews" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Fulfillment",
    subItems: [
      { name: "Shipping", path: "/seller/shipping" },
      { name: "Returns", path: "/seller/returns" },
      { name: "Disputes", path: "/seller/disputes" },
    ],
  },
  {
    icon: <CartIcon />,
    name: "Finance",
    subItems: [
      { name: "Earnings", path: "/seller/earnings" },
      { name: "Payments", path: "/seller/payments" },
      { name: "Payouts", path: "/seller/payouts" },
      { name: "Overview", path: "/seller/finance" },
      { name: "Subscription", path: "/seller/subscription" },
    ],
  },
  {
    icon: <MailIcon />,
    name: "Messages",
    path: "/seller/messages",
  },
  {
    icon: <ChatIcon />,
    name: "Notifications",
    path: "/account/notifications",
  },
  {
    icon: <ListIcon />,
    name: "Store",
    subItems: [
      { name: "Storefront", path: "/seller/storefront" },
      { name: "Staff", path: "/seller/staff" },
      { name: "Team", path: "/seller/team" },
      { name: "Vacation Mode", path: "/seller/vacation" },
      { name: "Verification", path: "/seller/verification" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Settings",
    subItems: [
      { name: "Account", path: "/seller/settings" },
      { name: "Onboarding", path: "/seller/onboarding" },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Account Standing",
    path: "/account/warnings",
  },
];

// =============================================================================
// BUYER NAVIGATION - /account/* (static, no permission filtering)
// =============================================================================

const BUYER_NAV: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/account",
  },
  {
    icon: <CartIcon />,
    name: "Shopping",
    subItems: [
      { name: "Orders", path: "/account/orders" },
      { name: "Purchases", path: "/account/purchases" },
      { name: "Offers", path: "/account/offers" },
      { name: "Watchlist", path: "/account/watchlist" },
      { name: "Saved Searches", path: "/account/saved-searches" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "My Listings",
    path: "/account/listings",
  },
  {
    icon: <ChatIcon />,
    name: "Issues",
    subItems: [
      { name: "Returns", path: "/account/returns" },
      { name: "Disputes", path: "/account/disputes" },
      { name: "Protection", path: "/account/protection" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Feedback",
    subItems: [
      { name: "Reviews", path: "/account/reviews" },
      { name: "Performance", path: "/account/performance" },
      { name: "Reports", path: "/account/reports" },
    ],
  },
  {
    icon: <MailIcon />,
    name: "Messages",
    path: "/account/messages",
  },
  {
    icon: <ChatIcon />,
    name: "Notifications",
    path: "/account/notifications",
  },
  {
    icon: <PlugInIcon />,
    name: "Activity",
    path: "/account/activity",
  },
  {
    icon: <ListIcon />,
    name: "Settings",
    subItems: [
      { name: "Account", path: "/account/settings" },
      { name: "Profile", path: "/account/profile" },
      { name: "Security", path: "/account/security" },
      { name: "Addresses", path: "/account/addresses" },
      { name: "Privacy", path: "/account/privacy" },
      { name: "Preferences", path: "/account/preferences" },
      { name: "Language", path: "/account/language" },
      { name: "Payment Methods", path: "/account/settings/payments" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Become a Seller",
    path: "/account/become-seller",
  },
  {
    icon: <UserCircleIcon />,
    name: "Account Standing",
    path: "/account/warnings",
  },
];

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { user } = useAuth();

  // Get dashboard item for staff users
  const dashboardItem = useMemo((): NavItem | null => {
    if (!user || user.role !== "STAFF") return null;
    return {
      name: CORP_DASHBOARD.name,
      icon: CORP_DASHBOARD.icon,
      path: CORP_DASHBOARD.path,
    };
  }, [user?.role]);

  // Get filtered Operations menu items for staff users
  const operationsMenuItems = useMemo((): NavItem[] => {
    if (!user || user.role !== "STAFF") return [];
    return filterByPermissions(OPERATIONS_MENU_ITEMS, user.permissions || []);
  }, [user?.role, user?.permissions]);

  // Get filtered Platform menu items for staff users
  const platformMenuItems = useMemo((): NavItem[] => {
    if (!user || user.role !== "STAFF") return [];
    return filterByPermissions(PLATFORM_MENU_ITEMS, user.permissions || []);
  }, [user?.role, user?.permissions]);

  // Get flat menu items for non-staff users
  const navItems = useMemo((): NavItem[] => {
    if (!user) return [];

    // Platform Staff uses corpMenuItems instead
    if (user.role === "STAFF") {
      return [];
    }

    // Seller - static menu
    if (user.role === "SELLER") {
      return SELLER_NAV;
    }

    // Buyer - static menu
    return BUYER_NAV;
  }, [user?.role, user?.permissions]);

  // Get all items for submenu auto-expand (flattened from sections or direct items)
  const allNavItems = useMemo((): NavItem[] => {
    if (operationsMenuItems.length > 0 || platformMenuItems.length > 0) {
      // Include dashboard item first, then operations, then platform
      const items: NavItem[] = [];
      if (dashboardItem) items.push(dashboardItem);
      items.push(...operationsMenuItems);
      items.push(...platformMenuItems);
      return items;
    }
    return navItems;
  }, [operationsMenuItems, platformMenuItems, navItems, dashboardItem]);

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  // Auto-expand submenu if current path matches a subitem
  useEffect(() => {
    let submenuMatched = false;
    allNavItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu(index);
            submenuMatched = true;
          }
        });
      }
    });
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive, allNavItems]);

  // Calculate submenu height for animation
  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `main-${openSubmenu}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) => (prev === index ? null : index));
  };

  const renderMenuItems = (items: NavItem[], indexOffset: number = 0) => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, localIndex) => {
        const globalIndex = indexOffset + localIndex;
        return (
          <li key={nav.name}>
            {nav.subItems ? (
              // Menu item with submenu
              <button
                onClick={() => handleSubmenuToggle(globalIndex)}
                className={`menu-item group ${
                  openSubmenu === globalIndex ? "menu-item-active" : "menu-item-inactive"
                } cursor-pointer ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span
                  className={`${
                    openSubmenu === globalIndex
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
                {(isExpanded || isHovered || isMobileOpen) && (
                  <ChevronDownIcon
                    className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                      openSubmenu === globalIndex ? "rotate-180 text-brand-500" : ""
                    }`}
                  />
                )}
              </button>
            ) : (
              // Single menu item (no submenu)
              nav.path && (
                <Link
                  href={nav.path}
                  className={`menu-item group ${
                    isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
                >
                  <span
                    className={`${
                      isActive(nav.path)
                        ? "menu-item-icon-active"
                        : "menu-item-icon-inactive"
                    }`}
                  >
                    {nav.icon}
                  </span>
                  {(isExpanded || isHovered || isMobileOpen) && (
                    <span className="menu-item-text">{nav.name}</span>
                  )}
                </Link>
              )
            )}
            {/* Submenu items */}
            {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`main-${globalIndex}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height: openSubmenu === globalIndex ? `${subMenuHeight[`main-${globalIndex}`]}px` : "0px",
                }}
              >
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
                        {subItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const renderSectionHeader = (title: string) => (
    <h2
      className="mb-4 text-xs font-semibold uppercase flex leading-5 text-gray-700 dark:text-gray-200 justify-center"
    >
      {isExpanded || isHovered || isMobileOpen ? title : <HorizontaLDots />}
    </h2>
  );

  return (
    <aside
      className={`fixed flex flex-col xl:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        xl:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "xl:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Twicely"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Twicely"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Twicely"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {/* Staff users - render dashboard, then sections with headers */}
            {dashboardItem && (
              <div>
                {renderMenuItems([dashboardItem], 0)}
              </div>
            )}
            {operationsMenuItems.length > 0 && (
              <div>
                {renderSectionHeader("Operations Management")}
                {renderMenuItems(operationsMenuItems, 1)}
              </div>
            )}
            {platformMenuItems.length > 0 && (
              <div>
                {renderSectionHeader("Platform Management")}
                {renderMenuItems(platformMenuItems, 1 + operationsMenuItems.length)}
              </div>
            )}
            {/* Non-staff users - render flat menu with "Menu" header */}
            {operationsMenuItems.length === 0 && platformMenuItems.length === 0 && navItems.length > 0 && (
              <div>
                {renderSectionHeader("Menu")}
                {renderMenuItems(navItems)}
              </div>
            )}
          </div>
        </nav>
        {/* Widget - only show for non-staff users */}
        {(isExpanded || isHovered || isMobileOpen) && user?.role !== "STAFF" && (
          <SidebarWidget />
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
