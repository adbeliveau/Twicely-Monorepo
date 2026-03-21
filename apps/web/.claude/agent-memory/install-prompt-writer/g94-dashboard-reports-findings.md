---
name: G9.4 Dashboard & Reports Findings
description: Gap analysis for helpdesk dashboard and reports - hardcoded deltas, missing CSAT, placeholder reports page, missing sidebar link
type: project
---

## G9.4 Helpdesk Dashboard & Reports — Findings (2026-03-16)

### Dashboard Page (`/hd/page.tsx`, 107 lines)
- 5 StatCards, all with `delta={0}` hardcoded
- CSAT card shows `value="—"` and `deltaLabel="no data yet"` — no caseCsat query
- SLA "Resolution" ring uses naive `resolvedToday > 0 ? 100 : 0` — not real compliance
- Imports from `helpdesk-dashboard.ts` (4 query functions)

### Reports Page (`/hd/reports/page.tsx`, 47 lines)
- Pure placeholder: 6 metric cards all showing `'—'`
- Body: "Detailed reports will be available in G9.6"
- No queries, no date range, no charts

### Dashboard Queries (`helpdesk-dashboard.ts`, 182 lines)
- `getHelpdeskDashboardStats()` returns: openCases, resolvedToday, avgResponseMinutes, slaBreached
- MISSING: csatScore, csatCount, avgResolutionMinutes, slaCompliancePct, SLA per-ring metrics
- `getHelpdeskCaseVolume()` — works correctly (7-day by channel)
- `getTeamWorkload()` — works correctly (per-agent case count)
- `getHelpdeskRecentActivity()` — BUG: returns raw actorId instead of display name, raw caseId instead of caseNumber

### Sidebar (`helpdesk-sidebar.tsx`, 207 lines)
- "Reports" link is COMPLETELY MISSING from navigation
- Canonical Section 6.1 says HELPDESK_LEAD gets `+ Macros, Reports`
- Need to add to "Manage" section with BarChart2 icon and permission gate

### Dashboard Widgets (`dashboard-widgets.tsx`, 177 lines)
- StatCard accepts `delta: number` — does NOT handle null/undefined gracefully
- CaseVolumeChart, TeamWorkloadRow, SlaRing, ActivityRow all work
- All are server components (no "use client")

### CASL State
- Reports page gate: HELPDESK_LEAD+ per Page Registry #110 and Actors Canonical Section 5.4
- No new CASL subject needed — uses existing `can('read', 'HelpdeskCase')`
- Additional role check needed for HELPDESK_LEAD minimum

### Key Schema Facts for Queries
- `helpdeskCase.slaFirstResponseBreached` (boolean) — set by slaCheck job
- `helpdeskCase.slaResolutionBreached` (boolean) — set by slaCheck job
- `helpdeskCase.firstResponseAt` (timestamp) — set when agent first replies
- `helpdeskCase.resolvedAt` (timestamp) — set on RESOLVED transition
- `caseCsat.rating` (integer 1-5) — CSAT score
- `caseCsat.respondedAt` (timestamp) — null if survey sent but not yet answered

### No Schema Changes Required
All metrics derivable from existing columns via SQL aggregation.
