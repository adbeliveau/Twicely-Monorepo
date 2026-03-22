'use client';

import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import CorpSidebar from '@/layout/CorpSidebar';
import Backdrop from '@/layout/Backdrop';
import AppHeader from '@/layout/AppHeader';
import { usePathname } from 'next/navigation';
import type { PlatformRole } from '@twicely/casl/types';

interface HubShellProps {
  children: React.ReactNode;
  displayName: string;
  roles: PlatformRole[];
}

function HubShellInner({ children }: HubShellProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'xl:ml-[290px]'
      : 'xl:ml-[90px]';

  // Route-specific styles for the main content container
  // Analytics, reports, health, and log pages need full-width (no max-width constraint)
  const getRouteSpecificStyles = (): string => {
    if (
      pathname?.includes('/analytics') ||
      pathname?.includes('/reports') ||
      pathname?.includes('/health') ||
      pathname?.includes('/logs')
    ) {
      return 'p-4 md:p-6';
    }
    return 'p-4 mx-auto max-w-screen-2xl md:p-6';
  };

  return (
    <div className="min-h-screen xl:flex">
      <CorpSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className={getRouteSpecificStyles()}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function HubShell({ children, displayName, roles }: HubShellProps) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <HubShellInner displayName={displayName} roles={roles}>
          {children}
        </HubShellInner>
      </SidebarProvider>
    </ThemeProvider>
  );
}
