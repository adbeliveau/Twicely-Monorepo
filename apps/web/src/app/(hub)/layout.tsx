import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { getStaffSession } from '@twicely/auth/staff-auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { StaffSessionTimeoutProvider } from '@/components/admin/staff-session-timeout';
import { SkipNav } from '@/components/shared/skip-nav';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function HubRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const subdomain = headerStore.get('x-subdomain');

  // Non-hub requests (marketplace /my/* pages) — skip hub staff shell
  if (subdomain !== 'hub') {
    return <>{children}</>;
  }

  const pathname = headerStore.get('x-pathname') ?? '';

  // The login page is public — render without the hub shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('twicely.staff_token')?.value;

  if (!token) {
    redirect('/login');
  }

  let staffSession;
  try {
    staffSession = await getStaffSession(token);
  } catch {
    redirect('/login');
  }

  if (!staffSession) {
    redirect('/login');
  }

  return (
    <StaffSessionTimeoutProvider initialExpiresAt={staffSession.expiresAt.toISOString()}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <SkipNav />
        <AdminSidebar roles={staffSession.roles} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar
            displayName={staffSession.displayName}
            roles={staffSession.roles}
          />

          <ImpersonationBanner />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </StaffSessionTimeoutProvider>
  );
}
