---
name: G9.7 Helpdesk UX Parity Findings
description: Gap analysis for G9.7 helpdesk mockup UX parity features - existing code state vs required
type: project
---

## Existing Code Inventory (Pre-G9.7)

### What Already Exists
- **Case number generator**: `src/lib/helpdesk/case-number.ts` uses `sequenceCounter` table with atomic increment, generates `HD-XXXXXX` format. ALREADY DONE.
- **SLA rings**: `SlaRing` component in `dashboard-widgets.tsx` (SVG circle-based). ALREADY EXISTS.
- **Activity feed**: `ActivityRow` component in `dashboard-widgets.tsx`, `getHelpdeskRecentActivity()` query in `helpdesk-activity.ts`. ALREADY EXISTS.
- **Team workload**: `TeamWorkloadRow` component. ALREADY EXISTS.
- **Stat cards with deltas**: `StatCard` component. ALREADY EXISTS with delta/arrow display.
- **Case volume chart**: CSS bar chart. ALREADY EXISTS.
- **Priority badges**: `PRIORITY_BADGE` map in `case-row.tsx` uses `hd-badge-critical`, `hd-badge-urgent`, etc. ALREADY EXISTS as text badges.
- **Internal note styling**: `hd-msg-internal` class in message-bubble with amber/yellow coloring and lock icon. ALREADY EXISTS.
- **Outbound message styling**: `hd-msg-outbound` class with green styling. ALREADY EXISTS but basic.
- **Quick actions toolbar**: Has Resolve, Escalate, Merge, Assign to me. ALREADY EXISTS.
- **Reply composer**: Macro picker, mode toggle (Reply/Internal), Cmd+Enter, Cmd+I, Cmd+M. ALREADY EXISTS.
- **Seed data**: 10 cases, 20 messages, 12 events, 6 macros in `seed-helpdesk-cases.ts`. ALREADY EXISTS.
- **Filter selects**: Status, priority, channel, assignee filter dropdowns on cases page. ALREADY EXISTS as `<select>` elements.
- **Keyboard shortcuts**: J/K navigation on case queue, hotkeys in workspace (R, N, E, M, ?, arrows, 1-5). ALREADY EXISTS.

### What's MISSING (G9.7 Scope)
1. **Priority color bars on case list** — case rows have text badges but no left-edge color bars
2. **Unread dots** — no tracking of which messages are unread per agent, no blue dot indicator
3. **Filter chips** — filters use `<select>` dropdowns, not removable chip pills
4. **AI suggestion card** — no AI integration at all, no Claude Haiku call, no suggestion display
5. **AI assist button** — no inline AI rewrite/summarize/translate in reply composer
6. **Live activity feed** — exists as static server-rendered list; no real-time streaming
7. **Team status grid** — workload exists but no online/away/offline agent counts per team
8. **SLA rings animation** — SLA rings exist but no stroke-dashoffset animation on mount
9. **Stat trend animations** — StatCard has deltas but no sparkline/mini-chart
10. **Message signatures** — `signatureHtml` column EXISTS on `helpdeskEmailConfig` but:
    - NOT per-agent (it's on the email config table, not on staffUser or teamMember)
    - Not appended to outbound replies
    - No UI to edit signature
11. **Outbound gradient styling** — outbound uses `hd-msg-outbound` class but no gradient
12. **Internal note enhanced lock styling** — has amber/lock but no locked-border/yellow-bg gradient
13. **Prominent resolve button** — resolve button exists in quick-actions-toolbar but same styling as other actions
14. **More seed data** — 10 cases exist, may need more variety for demo

### Schema Notes
- `staffUser` table has NO `signatureHtml` column
- `helpdeskEmailConfig` has a single `signatureHtml` (global, not per-agent)
- `helpdeskTeamMember` has `isAvailable` boolean but no online/away/offline status
- No `lastSeenAt` on team member or staff user
- No `unreadMessageCount` or read-tracking on helpdesk cases

### Platform Settings
- NO `helpdesk.ai.*` settings exist yet
- Need: `helpdesk.ai.provider`, `helpdesk.ai.model`, `helpdesk.ai.suggestionEnabled`, `helpdesk.ai.assistEnabled`

### Spec Inconsistencies
1. Build Tracker says "Claude Haiku" but model ID is `claude-haiku-4-5-20251001` — this is a future model. Code should read from platform_settings so model is configurable.
2. Per-agent signature requires a new column on `staffUser` or a new `helpdeskAgentSignature` approach. Schema doc doesn't specify this. DECISION NEEDED.
3. Unread tracking is not in the Helpdesk Canonical. Need to decide: per-agent read cursor on caseMessage vs lastReadAt on helpdeskCase?
4. "Live feed" — Canonical §15 specifies Centrifugo channels but no real-time is wired yet. This step should add polling-based refresh, not full Centrifugo wiring.
