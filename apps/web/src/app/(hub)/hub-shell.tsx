'use client';

import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import CorpSidebar from '@/layout/CorpSidebar';
import Backdrop from '@/layout/Backdrop';
import AppHeader from '@/layout/AppHeader';
import type { PlatformRole } from '@twicely/casl/types';

interface HubShellProps {
  children: React.ReactNode;
  displayName: string;
  roles: PlatformRole[];
}

function HubShellInner({ children, displayName, roles }: HubShellProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'xl:ml-[290px]'
      : 'xl:ml-[90px]';

  return (
    <div className="min-h-screen xl:flex bg-gray-50 dark:bg-gray-900">
      <CorpSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader displayName={displayName} roles={roles} />
        <main
          id="main-content"
          tabIndex={-1}
          className="p-4 mx-auto max-w-screen-2xl md:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function HubShell({ children, displayName, roles }: HubShellProps) {
  return (
    <SidebarProvider>
      <HubShellInner displayName={displayName} roles={roles}>
        {children}
      </HubShellInner>
    </SidebarProvider>
  );
}
