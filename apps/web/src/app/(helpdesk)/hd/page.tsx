import type { Metadata } from "next";
import { staffAuthorizeOrRedirect } from "@/lib/casl/staff-authorize";
import { StatCard, CaseVolumeChart, SlaRing, TeamWorkloadRow } from "./dashboard-widgets";
import {
  getHelpdeskDashboardStats,
  getHelpdeskCaseVolume,
  getTeamWorkload,
  getTeamStatusGrid,
  getStatTrends,
} from "@/lib/queries/helpdesk-dashboard";
import { getHelpdeskDashboardDeltas } from "@/lib/queries/helpdesk-dashboard-deltas";
import { getHelpdeskRecentActivity } from "@/lib/queries/helpdesk-activity";
import { TeamStatusGrid } from "@/components/helpdesk/team-status-grid";
import { LiveActivityFeed } from "@/components/helpdesk/live-activity-feed";

export const metadata: Metadata = { title: "Helpdesk Dashboard | Twicely Hub" };

export default async function HelpdeskDashboardPage() {
  const { ability } = await staffAuthorizeOrRedirect();
  if (!ability.can("read", "HelpdeskCase")) {
    return <p className="p-6 text-sm text-red-600">Access denied</p>;
  }

  const [stats, deltas, volume, activity, workload, teamStatus, trends] = await Promise.all([
    getHelpdeskDashboardStats(),
    getHelpdeskDashboardDeltas(),
    getHelpdeskCaseVolume(),
    getHelpdeskRecentActivity(),
    getTeamWorkload(),
    getTeamStatusGrid(),
    getStatTrends(),
  ]);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}.${Math.round((m / 60) * 10)}h` : `${h}h`;
  };

  const csatValue = stats.csatScore !== null ? stats.csatScore.toFixed(1) : "—";
  const csatDeltaLabel = stats.csatCount > 0 ? `${stats.csatCount} ratings` : "no data yet";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "rgb(var(--hd-text-primary))" }}>Dashboard</h1>
        <p className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>{dateStr} · Support Team</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="OPEN CASES" value={stats.openCases} delta={deltas.openCasesDelta} deltaLabel="vs yesterday" color="blue" isPositiveGood={false} trend={trends.openCasesTrend} />
        <StatCard label="RESOLVED TODAY" value={stats.resolvedToday} delta={deltas.resolvedTodayDelta} deltaLabel="vs yesterday" color="green" isPositiveGood trend={trends.resolvedTrend} />
        <StatCard label="AVG RESPONSE" value={formatTime(stats.avgResponseMinutes)} delta={deltas.avgResponseDelta} deltaLabel="vs prev 30d" deltaIsMinutes color="cyan" isPositiveGood={false} trend={trends.avgResponseTrend} />
        <StatCard label="SLA BREACHED" value={stats.slaBreached} delta={deltas.slaBreachedDelta} deltaLabel="vs yesterday" color="red" isPositiveGood={false} trend={trends.slaBreachedTrend} />
        <StatCard label="CSAT SCORE" value={csatValue} delta={deltas.csatDelta} deltaLabel={csatDeltaLabel} color="amber" isPositiveGood trend={trends.csatTrend} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Case Volume Chart */}
        <div className="lg:col-span-3 rounded-2xl border p-5" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "rgb(var(--hd-text-primary))" }}>Case Volume</h3>
              <p className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>Last 7 Days</p>
            </div>
            <span className="px-3 py-1 text-xs font-medium rounded-full" style={{ background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-secondary))" }}>By channel</span>
          </div>
          <CaseVolumeChart data={volume} />
        </div>

        {/* Right Column — Team Workload + SLA */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Workload */}
          <div className="rounded-2xl border p-5" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "rgb(var(--hd-text-primary))" }}>Team Workload</h3>
            {workload.length > 0 ? (
              <div className="space-y-4">
                {workload.map((agent) => <TeamWorkloadRow key={agent.name} agent={agent} />)}
              </div>
            ) : (
              <p className="text-sm py-4 text-center" style={{ color: "rgb(var(--hd-text-muted))" }}>No assigned cases</p>
            )}
          </div>

          {/* Team Status Grid */}
          <div className="rounded-2xl border p-5" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "rgb(var(--hd-text-primary))" }}>Team Status</h3>
            <TeamStatusGrid teams={teamStatus} />
          </div>

          {/* SLA Compliance */}
          <div className="rounded-2xl border p-5" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "rgb(var(--hd-text-primary))" }}>SLA Compliance</h3>
            <div className="grid grid-cols-2 gap-4">
              <SlaRing label="1st Response" value={stats.slaFirstResponsePct} />
              <SlaRing label="Resolution" value={stats.slaResolutionPct} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border p-5 relative" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "rgb(var(--hd-text-primary))" }}>Recent Activity</h3>
        <LiveActivityFeed initialActivity={activity} />
      </div>
    </div>
  );
}
