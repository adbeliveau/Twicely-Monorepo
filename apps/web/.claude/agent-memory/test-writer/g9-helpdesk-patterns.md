---
name: G9 Helpdesk Testing Patterns
description: Patterns, edge cases, and gotchas for G9 helpdesk test files
type: project
---

## G9.6/G9.7 Helpdesk Polish — Test Coverage Notes

### Files Covered
- `helpdesk-ai.ts` actions — tested in `helpdesk-ai.test.ts` (both getAiSuggestion + getAiAssist)
- `helpdesk-signature.ts` — tested in `helpdesk-signature.test.ts`
- `helpdesk-agent.ts` — `toggleAgentOnlineStatus` in `helpdesk-agent-online.test.ts`; ALL other actions in `helpdesk-agent-actions.test.ts`
- `helpdesk-retention-purge.ts` job — `helpdesk-retention-purge.test.ts`
- `helpdesk-cases.ts` queries — `getResolvedCases` in `helpdesk-resolved.test.ts`; ALL others in `helpdesk-cases-queries.test.ts`
- `helpdesk-dashboard.ts` — `getTeamStatusGrid` + `getStatTrends` in `helpdesk-team-status.test.ts`; `getDashboardStats` + `getCaseVolume` + `getTeamWorkload` in `helpdesk-dashboard-stats.test.ts`
- `helpdesk-agents.ts` — `getAgentOnlineStatus` in `helpdesk-resolved.test.ts`; `getHelpdeskAgentsAndTeams` in `helpdesk-cases-queries.test.ts`
- `activity/route.ts` — fully covered in `route.test.ts`
- `cases/route.ts` — unread logic in `unread-logic.test.ts`; auth + filters + team enrichment in `route-auth-filters.test.ts`

### Implementation Behavior Gotchas

**helpdesk-signature.ts sanitization:**
- Implementation uses HTML entity ESCAPING, NOT tag stripping
- `<script>` → `&lt;script&gt;` (the literal `<script>` is gone but `alert(...)` text remains encoded)
- `\n` → `<br />`
- Do NOT assert `not.toContain('alert')` — the text is still there, just encoded
- DO assert `not.toContain('<script>')` (the raw tag is gone) and `toContain('&lt;script&gt;')`

**helpdesk-retention-purge.ts enqueue:**
- `enqueueHelpdeskRetentionPurge` calls `queue.add(name, data, options)` — 3 arguments
- 3rd arg includes: `{ jobId: 'helpdesk-retention-purge', repeat: { pattern: '0 4 * * *' }, removeOnComplete: true, removeOnFail: { count: 50 } }`
- Test: `expect(mockQueueAdd).toHaveBeenCalledWith('retention-purge', expect.objectContaining({ triggeredAt: ... }), expect.objectContaining({ jobId: 'helpdesk-retention-purge' }))`

### sql .as() Mock (helpdesk-dashboard-stats.test.ts)
`getHelpdeskDashboardStats` and `getHelpdeskCaseVolume` use `sql\`...\`.as('alias')`. The drizzle-orm mock must return objects with `.as()` from `sql` tagged template calls:
```typescript
function makeSqlExpr(raw: string) {
  return { sql: raw, as: (alias: string) => ({ sql: raw, alias }) };
}
// sql mock must be a function with static methods:
sql: Object.assign(
  (tpl: TemplateStringsArray, ...vals: unknown[]) => makeSqlExpr(tpl.join(String(vals[0] ?? ''))),
  { as: vi.fn(), join: vi.fn(...) }
)
```

### helpdesk-agent.ts CASL gates per function
- `addTeamMember`: `ability.can('manage', 'HelpdeskTeam')` — also checks team exists (returns 'Not found')
- `removeTeamMember`: `ability.can('manage', 'HelpdeskTeam')`
- `toggleTeamMemberAvailability`: `ability.can('manage', 'HelpdeskTeam')`
- `toggleRoutingRule`: `ability.can('manage', 'HelpdeskRoutingRule')`
- `reorderRoutingRules`: `ability.can('manage', 'HelpdeskRoutingRule')`
- `createMacro`: `ability.can('manage', 'HelpdeskMacro')`
- `deleteMacro`: `ability.can('manage', 'HelpdeskMacro')`
- `createSavedView`: `ability.can('read', 'HelpdeskSavedView')` — NOTE: 'read' not 'manage'
- `deleteSavedView`: ownership check only (no CASL) — checks `existingView.staffUserId !== session.staffUserId`
- `updateSlaPolicyTargets`: `ability.can('manage', 'HelpdeskSlaPolicy')`
- `toggleAutomationRule`: `ability.can('manage', 'HelpdeskAutomationRule')`
- `addCaseWatcher`: `ability.can('manage', 'HelpdeskCase')`
- `removeCaseWatcher`: `ability.can('manage', 'HelpdeskCase')`

### cases/route.ts filter behavior
- Invalid status/priority/channel values are silently IGNORED (not an error) — filter just doesn't apply
- `assignee=me` → filters by `session.staffUserId`
- `assignee=unassigned` → filters by `isNull(assignedAgentId)`
- Teams query only fires when `teamIds.length > 0` (cases have assignedTeamId set)
- `hasUnread` computation: skipped entirely for RESOLVED/CLOSED cases (always false)
- Response shape: `{ cases: [...], total: cases.length }`

### BullMQ job mocking pattern
```typescript
const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockClose = vi.hoisted(() => vi.fn());
vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd, close: mockClose }),
  createWorker: vi.fn().mockReturnValue({ close: mockClose }),
}));
```
All mock functions referenced in `vi.mock()` factory callbacks MUST be declared with `vi.hoisted()`.
