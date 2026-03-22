"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

type HelpdeskContextType = {
  isSidebarHidden: boolean;  // True when in workspace mode (sidebar becomes a drawer)
  isDrawerOpen: boolean;     // True when the drawer is open (only relevant when isSidebarHidden)
  showSidebar: () => void;   // Show the drawer
  hideSidebar: () => void;   // Hide the drawer
  toggleSidebar: () => void; // Toggle drawer visibility
};

const HelpdeskContext = createContext<HelpdeskContextType | undefined>(undefined);

export const useHelpdesk = () => {
  const context = useContext(HelpdeskContext);
  if (!context) {
    throw new Error("useHelpdesk must be used within a HelpdeskProvider");
  }
  return context;
};

export const HelpdeskProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Auto-hide sidebar when navigating to a case detail page
  useEffect(() => {
    if (pathname.match(/\/hd\/cases\/[^/]+$/)) {
      // On case detail page - switch to drawer mode (workspace mode)
      setIsSidebarHidden(true);
      setIsDrawerOpen(false); // Close drawer on navigation
    } else {
      // On all other helpdesk pages - show sidebar normally
      setIsSidebarHidden(false);
      setIsDrawerOpen(false);
    }
  }, [pathname]);

  const showSidebar = useCallback(() => {
    if (isSidebarHidden) {
      setIsDrawerOpen(true);
    }
  }, [isSidebarHidden]);

  const hideSidebar = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isSidebarHidden) {
      setIsDrawerOpen((prev) => !prev);
    }
  }, [isSidebarHidden]);

  return (
    <HelpdeskContext.Provider
      value={{
        isSidebarHidden,
        isDrawerOpen,
        showSidebar,
        hideSidebar,
        toggleSidebar,
      }}
    >
      {children}
    </HelpdeskContext.Provider>
  );
};
