---
name: G9.3 Workspace UX Findings
description: Findings from analyzing existing helpdesk workspace code for G9.3 UX port
type: project
---

## G9.3 Helpdesk Workspace UX Port (Prompt WRITTEN 2026-03-16)

### Key Existing Code State
- case-workspace.tsx: 189 lines. Has reply/note handlers, timeline building, 3-panel render. NO keyboard nav, NO optimistic replies, NO quick actions.
- case-queue-panel.tsx: 133 lines. Has search filter, case list with links. NO keyboard traversal between cases.
- reply-composer.tsx: 215 lines. Has Cmd+Enter, Cmd+I, Cmd+M shortcuts. Has macro picker with search. NO variable substitution.
- context-panel.tsx: 206 lines. Has requester, order, SLA, KB, tags, previous cases, assignment sections.
- case-status-control.tsx: 85 lines. Uses <select> with light-mode colors. NOT wired to workspace header.
- helpdesk-agent-cases.ts: 253 lines. Has addAgentReply, updateCaseStatus, assignCase, updateCasePriority, updateCaseTags.
- helpdesk.ts (validations): 168 lines. Has all existing schemas.
- helpdesk-cases.ts (queries): 228 lines. Has getAgentCaseDetail, getAgentCaseQueue.

### Merge Schema Already Exists
- `mergedIntoCaseId` column on helpdeskCase (line 48 of helpdesk.ts schema)
- `fromMergedCaseId` column on caseMessage (line 80)
- `fromMergedCaseId` column on caseEvent (line 94)
- Index: `mergedIntoIdx` on helpdeskCase

### Snooze Does NOT Exist in Canonical
- Build tracker mentions "snooze from toolbar" but NO canonical document defines snooze
- No snooze column in schema, no snooze enum value, no snooze in Feature Lock-in
- Flagged as NOT SPECIFIED in install prompt

### Keyboard Shortcuts (Canonical §6.2)
- `Cmd+K` / `Ctrl+K`: Global search (RESERVED, do not override)
- `R`: Reply | `N`: Internal note | `E`: Escalate | `M`: Open macro picker
- `Cmd+Enter`: Send | `Cmd+Shift+R`: Resolve | `←`/`→`: Prev/next case | `1`-`5`: Priority
- `?`: Toggle shortcut help panel

### Macro Category Gap
- Canonical §9.2 says macros have category enum (REFUND, SHIPPING, etc.)
- Actual helpdeskMacro table has NO category column
- getAgentMacros() hardcodes `category: 'General'`
- Deferred to G9.2 macro management CRUD

### Layout Mismatch
- Canonical §7.1 says "Left Column: Case Properties (280px fixed)"
- Actual implementation: left=queue panel, center=conversation, right=context
- Properties (status, priority, assignment) currently shown as read-only badges in center column header
- G9.3 adds dropdowns to the header rather than restructuring to 4 columns

### How to apply
When writing future helpdesk prompts, reference these findings rather than re-reading all files.
