---
name: G9.6 Helpdesk Polish Findings
description: Gap analysis for G9.6 helpdesk polish — agent online persistence, resolved archive, watcher UI, notifications, retention countdown
type: project
---

## What Exists

### Agent Online Status
- HelpdeskSidebar has `AgentStatus` interface: `{ name, avatarUrl?, isOnline, caseCount }`
- `onToggleStatus` callback in sidebar footer (button toggles online/offline)
- HelpdeskLayoutClient has `const [isOnline, setIsOnline] = useState(true)` — CLIENT-ONLY state, resets to `true` on every page load
- `helpdeskTeamMember.isAvailable` column EXISTS in schema (boolean, default true)
- NO server action to persist agent online/away status
- NO query to read agent's persisted status from DB
- The isAvailable on teamMember is per-team, not global. Need to reconcile.

### Watcher System
- `caseWatcher` table EXISTS in schema (caseId, staffUserId, createdAt, unique constraint)
- `addCaseWatcher` and `removeCaseWatcher` actions EXIST in helpdesk-agent.ts
- NO UI component for watchers (no watcher list, no "Watch" button, no watcher badges)
- NO notification template for watcher updates (e.g., when watched case gets activity)
- Merge action copies watchers from source to target case (G9.1 complete)

### Resolved Cases Archive
- Sidebar links "Resolved Cases" to `/hd/views` — this is the saved views page, NOT a resolved archive
- Cases page (/hd/cases) can filter by status=RESOLVED via filter dropdowns
- NO dedicated `/hd/resolved` or `/hd/cases?view=resolved` page
- NO retention countdown badges anywhere
- `helpdesk.retentionDays` platform setting EXISTS (365 days, seeded)
- `helpdesk-auto-close.ts` job auto-closes RESOLVED cases after `helpdesk.autoClose.resolvedDays` (7 days) but does NOT delete them
- NO deletion/purge job for cases past retentionDays
- `helpdeskEmailConfig.resolvedRetentionDays` column exists (default 365) but is on the email config, separate from the platform setting

### Notification Templates
- 11 templates exist in templates-helpdesk.ts:
  - case.created, case.auto_reply, case.agent_reply, case.resolved, case.closed, case.reopened
  - csat.request
  - agent.assigned, agent.sla_warning, agent.sla_breach, agent.mention
- MISSING templates per canonical:
  - `helpdesk.case.watcher_update` — notify watchers when watched case gets activity
  - `helpdesk.case.status_changed` — notify requester when case status changes (to PENDING_USER, ON_HOLD)
  - `helpdesk.case.escalated` — notify requester when case is escalated

### BullMQ Jobs
- `helpdesk-auto-close.ts` — closes PENDING_USER (14d) and RESOLVED (7d) cases
- `helpdesk-sla-check.ts` — SLA warning/breach detection
- `helpdesk-csat-send.ts` — CSAT survey dispatch
- NO retention purge job (delete/anonymize cases past helpdesk.retentionDays)

## Spec Inconsistencies

1. **isAvailable vs isOnline**: Canonical uses `isAvailable` on helpdeskTeamMember (per-team). The sidebar uses `isOnline` as a global status. Need a global online status that syncs to per-team availability.

2. **Sidebar "Resolved Cases" links to /hd/views**: Per canonical §8.1, "Resolved" is a default queue view (status=RESOLVED), not a separate page. The sidebar archive section currently points to /hd/views which is the saved views management page. Fix: point to `/hd/cases?status=RESOLVED`.

3. **Retention countdown vs auto-close**: The canonical specifies `helpdesk.retentionDays` (365) for data retention/deletion, and `helpdesk.autoClose.resolvedDays` (7) for RESOLVED->CLOSED transition. These are different concepts. The retention countdown badge should show days until data deletion (retentionDays from closedAt), NOT days until auto-close.

4. **helpdeskEmailConfig.resolvedRetentionDays vs platformSetting helpdesk.retentionDays**: Both store retention days but in different places. Platform setting should be authoritative.
