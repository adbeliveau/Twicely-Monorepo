import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getCustomRoleList } from '@/lib/queries/admin-staff';
import { RoleCard } from '@/components/admin/role-card';
import type { RoleCardData } from '@/components/admin/role-card';

export const metadata: Metadata = { title: 'Roles | Twicely Hub' };

// ─── Static system role definitions ───────────────────────────────────────────

interface SystemRoleDefinition {
  code: string;
  displayName: string;
  description: string;
  isLocked: boolean;
  permissionSummary: string;
  platformTeamAccess: string;
  businessAccountsAccess: string;
}

const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    code: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full platform access. Bypasses all permission checks via wildcard.',
    isLocked: true,
    permissionSummary: 'Full access (wildcard)',
    platformTeamAccess: 'Full access',
    businessAccountsAccess: 'Full access',
  },
  {
    code: 'ADMIN',
    displayName: 'Platform Admin',
    description: 'Manages users, listings, orders, disputes, and most platform operations.',
    isLocked: false,
    permissionSummary: 'Broad platform management',
    platformTeamAccess: 'Create/Edit/Delete',
    businessAccountsAccess: 'Create/Edit/Delete',
  },
  {
    code: 'MODERATION',
    displayName: 'Content Moderator',
    description: 'Reviews flagged content, moderates listings and reviews.',
    isLocked: false,
    permissionSummary: 'Listings & reviews moderation',
    platformTeamAccess: 'No access',
    businessAccountsAccess: 'View only',
  },
  {
    code: 'DEVELOPER',
    displayName: 'Developer',
    description: 'Access to technical tools, feature flags, and system diagnostics.',
    isLocked: false,
    permissionSummary: 'Technical & diagnostic access',
    platformTeamAccess: 'View only',
    businessAccountsAccess: 'No access',
  },
  {
    code: 'FINANCE',
    displayName: 'Finance Admin',
    description: 'Manages financial reports, payouts, holds, and reconciliation.',
    isLocked: false,
    permissionSummary: 'Finance & payout management',
    platformTeamAccess: 'No access',
    businessAccountsAccess: 'View only',
  },
  {
    code: 'HELPDESK_AGENT',
    displayName: 'Helpdesk Agent',
    description: 'Customer service representative — handles cases, replies, resolves.',
    isLocked: false,
    permissionSummary: 'Support case management',
    platformTeamAccess: 'No access',
    businessAccountsAccess: 'View only',
  },
  {
    code: 'HELPDESK_LEAD',
    displayName: 'Helpdesk Lead',
    description: 'Senior agent — manages macros, views, assigns cases, views reports.',
    isLocked: false,
    permissionSummary: 'Lead support operations',
    platformTeamAccess: 'No access',
    businessAccountsAccess: 'View only',
  },
  {
    code: 'HELPDESK_MANAGER',
    displayName: 'Helpdesk Manager',
    description: 'Manages teams, routing, SLA, automation — full helpdesk operations.',
    isLocked: false,
    permissionSummary: 'Full helpdesk operations',
    platformTeamAccess: 'No access',
    businessAccountsAccess: 'View only',
  },
  {
    code: 'SRE',
    displayName: 'Site Reliability Engineer',
    description: 'Monitors system health, diagnostics, and operational settings.',
    isLocked: false,
    permissionSummary: 'System health & diagnostics',
    platformTeamAccess: 'View only',
    businessAccountsAccess: 'No access',
  },
  {
    code: 'SUPPORT',
    displayName: 'Support Agent',
    description: 'Handles customer inquiries, order issues, and dispute management.',
    isLocked: false,
    permissionSummary: 'Customer support & disputes',
    platformTeamAccess: 'No access',
    businessAccountsAccess: 'View only',
  },
];

const STATIC_UPDATED = 'Jan 1, 2025';

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function RolesPage() {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('read', 'CustomRole')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const isSuperAdmin = session.platformRoles.includes('SUPER_ADMIN');
  const customRoles = await getCustomRoleList();

  // Build system role cards
  const systemCards: RoleCardData[] = SYSTEM_ROLES.map((r) => ({
    id: r.code,
    displayName: r.displayName,
    code: r.code,
    description: r.description,
    isSystem: true,
    isLocked: r.isLocked,
    permissionSummary: r.permissionSummary,
    updatedAt: STATIC_UPDATED,
    platformTeamAccess: r.platformTeamAccess,
    businessAccountsAccess: r.businessAccountsAccess,
    editHref: `/roles/system/${r.code}`,
  }));

  // Build custom role cards
  const customCards: RoleCardData[] = customRoles.map((r) => ({
    id: r.id,
    displayName: r.name,
    code: r.code,
    description: r.description ?? 'No description',
    isSystem: false,
    isLocked: false,
    permissionSummary: 'Custom permission set',
    updatedAt: r.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    platformTeamAccess: 'Custom',
    businessAccountsAccess: 'Custom',
    editHref: `/roles/custom/${r.id}`,
  }));

  const allCards = [...systemCards, ...customCards];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Roles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edit platform roles and configure admin permissions.
        </p>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">Platform Roles</h2>
          <p className="text-sm text-gray-500">
            Create custom roles or edit permissions for existing ones.
          </p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/roles/custom/new"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            New Role
          </Link>
        )}
      </div>

      {/* 3-column roles grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allCards.map((card) => (
          <RoleCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}
