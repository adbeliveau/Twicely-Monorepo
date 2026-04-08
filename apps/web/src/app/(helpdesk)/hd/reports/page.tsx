import type { Metadata } from 'next';
import { staffAuthorizeOrRedirect } from '@twicely/casl/staff-authorize';
import type { PlatformRole } from '@twicely/casl/types';
import {
  getHelpdeskReportMetrics,
  getHelpdeskVolumeTimeseries,
  getHelpdeskCasesByType,
  getHelpdeskCasesByChannel,
  getHelpdeskAgentPerformance,
} from '@/lib/queries/helpdesk-reports';
import { BarChart2 } from 'lucide-react';
import {
  ReportMetricCard,
  VolumeTimeseries,
  HorizontalBarList,
  AgentPerformanceTable,
  DateRangeSelector,
} from './report-widgets';

export const metadata: Metadata = { title: 'Reports | Twicely Hub' };

type Preset = 'today' | 'this_week' | 'this_month' | 'last_30_days';

function getDateRange(preset: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (preset as Preset) {
    case 'today':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to };
    case 'this_week': {
      const d = new Date(to);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return { from: d, to };
    }
    case 'this_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case 'last_30_days':
    default: {
      const d = new Date(to);
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return { from: d, to };
    }
  }
}

function fmtTime(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const ALLOWED_ROLES: PlatformRole[] = ['HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

export default async function HelpdeskReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { ability, session } = await staffAuthorizeOrRedirect();
  if (!ability.can('read', 'HelpdeskCase')) {
    return <p className="p-6 text-sm text-red-600">Access denied.</p>;
  }

  const hasAccess = session.platformRoles.some((r) => ALLOWED_ROLES.includes(r));
  if (!hasAccess) {
    return <p className="p-6 text-sm text-red-600">Access denied. Reports require HELPDESK_LEAD or higher.</p>;
  }

  const params = await searchParams;
  const preset = (params.preset as string) || 'last_30_days';
  const dateRange = getDateRange(preset);

  const [metrics, volume, byType, byChannel, agentPerf] = await Promise.all([
    getHelpdeskReportMetrics(dateRange),
    getHelpdeskVolumeTimeseries(dateRange),
    getHelpdeskCasesByType(dateRange),
    getHelpdeskCasesByChannel(dateRange),
    getHelpdeskAgentPerformance(dateRange),
  ]);

  const typeItems = byType.map((r) => ({ label: r.type, value: r.count }));
  const channelItems = byChannel.map((r) => ({ label: r.channel, value: r.count }));

  const presetLabels: Record<string, string> = {
    today: 'Today', this_week: 'This Week',
    this_month: 'This Month', last_30_days: 'Last 30 Days',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-gray-500" />
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{presetLabels[preset] ?? 'Last 30 Days'}</span>
          <DateRangeSelector currentPreset={preset} />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportMetricCard label="Open Cases" value={metrics.openCases} />
        <ReportMetricCard label="Avg First Response" value={fmtTime(metrics.avgFirstResponseMinutes)} />
        <ReportMetricCard label="Avg Resolution Time" value={fmtTime(metrics.avgResolutionMinutes)} />
        <ReportMetricCard label="SLA Compliance" value={`${metrics.slaCompliancePct}%`} />
        <ReportMetricCard label="CSAT Score" value={metrics.csatScore !== null ? metrics.csatScore.toFixed(1) : '—'} />
        <ReportMetricCard label="Resolved (period)" value={metrics.resolvedCount} />
      </div>

      {/* Volume Timeseries */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Case Volume — Created vs Resolved</h2>
        <VolumeTimeseries data={volume} />
      </div>

      {/* Type + Channel Breakdown */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Cases by Type</h2>
          <HorizontalBarList items={typeItems} colorClass="bg-brand-500" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Cases by Channel</h2>
          <HorizontalBarList items={channelItems} colorClass="bg-emerald-500" />
        </div>
      </div>

      {/* Agent Performance */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Agent Performance</h2>
        <AgentPerformanceTable agents={agentPerf} />
      </div>
    </div>
  );
}
