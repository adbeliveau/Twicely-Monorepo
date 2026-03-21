import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getModerationKPIs, getModerationStats } from '@/lib/queries/admin-moderation';
import { getContentReportCountByStatus } from '@/lib/queries/content-reports';
import { getEnforcementKPIs } from '@/lib/queries/enforcement-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { Tag, MessageSquare, Star, Flag, Gavel, Clock, ListTodo, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Moderation | Twicely Hub' };

export default async function ModerationPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [kpis, reportCounts, enforcementKPIs, stats] = await Promise.all([
    getModerationKPIs(),
    getContentReportCountByStatus(),
    getEnforcementKPIs(),
    getModerationStats(),
  ]);

  const pendingReports = reportCounts.PENDING + reportCounts.UNDER_REVIEW;
  const activeEnforcement =
    enforcementKPIs.activeWarnings +
    enforcementKPIs.activeRestrictions +
    enforcementKPIs.activeSuspensions;

  const queueSize = kpis.flaggedListings + pendingReports + kpis.flaggedReviews;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader title="Moderation" description="Content moderation queue" />
        <Link
          href="/mod/queue"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Go to Queue <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Queue Size" value={queueSize} icon={<ListTodo className="h-4 w-4" />} color="warning" />
        <StatCard label="Flagged Listings" value={kpis.flaggedListings} icon={<Tag className="h-4 w-4" />} />
        <StatCard label="Flagged Reviews" value={kpis.flaggedReviews} icon={<Star className="h-4 w-4" />} />
        <StatCard label="Flagged Messages" value={kpis.flaggedMessages} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="Pending Reports" value={pendingReports} icon={<Flag className="h-4 w-4" />} />
        <StatCard label="Active Enforcement" value={activeEnforcement} icon={<Gavel className="h-4 w-4" />} />
        <StatCard label="Reports Today" value={stats.reportsToday} icon={<Flag className="h-4 w-4" />} color="error" />
        <StatCard label="Avg Resolution" value={`${stats.avgResolutionHours}h`} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/mod/queue" className="block rounded-lg border border-primary/20 bg-primary/5 p-4 hover:border-primary/40">
          <h3 className="text-sm font-semibold text-primary">Moderation Queue</h3>
          <p className="mt-1 text-xs text-gray-500">Unified prioritised queue of all pending work</p>
        </Link>
        <Link href="/mod/listings" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Flagged Listings</h3>
          <p className="mt-1 text-xs text-gray-500">Review and action flagged listings</p>
        </Link>
        <Link href="/mod/reviews" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Flagged Reviews</h3>
          <p className="mt-1 text-xs text-gray-500">Review and moderate flagged reviews</p>
        </Link>
        <Link href="/mod/messages" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Flagged Messages</h3>
          <p className="mt-1 text-xs text-gray-500">Messaging moderation</p>
        </Link>
        <Link href="/mod/disputes" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Disputes</h3>
          <p className="mt-1 text-xs text-gray-500">View and resolve open disputes</p>
        </Link>
        <Link href="/mod/reports" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Content Reports</h3>
          <p className="mt-1 text-xs text-gray-500">Review user-submitted content reports</p>
        </Link>
        <Link href="/mod/enforcement" className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Enforcement Actions</h3>
          <p className="mt-1 text-xs text-gray-500">Track and manage enforcement actions</p>
        </Link>
      </div>
    </div>
  );
}
