---
name: G9.2 Helpdesk Management CRUD Findings
description: Gap analysis for G9.2 helpdesk management pages - existing vs needed actions, schema discrepancies, CASL gates
type: project
---

## G9.2 Helpdesk Management CRUD — Findings (2026-03-16)

### Existing Actions (helpdesk-agent.ts, 297 lines — AT LIMIT)
- createMacro, deleteMacro
- toggleRoutingRule, reorderRoutingRules
- updateSlaPolicyTargets (first response + resolution minutes only)
- toggleAutomationRule
- addTeamMember, removeTeamMember, toggleTeamMemberAvailability
- createSavedView, deleteSavedView
- addCaseWatcher, removeCaseWatcher

### Missing Actions (need new file: helpdesk-manage.ts)
- updateMacro, createTeam, updateTeam
- createRoutingRule, updateRoutingRule, deleteRoutingRule
- createAutomationRule, updateAutomationRule, deleteAutomationRule
- updateSlaPolicyFields (extended to include businessHoursOnly + escalateOnBreach)
- updateHelpdeskSetting (helpdesk-specific, keys must start with `helpdesk.`)

### Schema vs Canonical Discrepancies
1. helpdeskRoutingRule: ACTUAL uses conditionsJson + actionsJson (both jsonb), NO separate assignTeamId/assignAgentId/setPriority/addTags/setCategory/createdByStaffId columns. Canonical sketch has them as separate columns.
2. helpdeskTeam: ACTUAL has `name` only, NO `displayName`. Canonical sketch has both.
3. helpdeskSlaPolicy: ACTUAL has NO `escalateToTeamId`. Canonical sketch has it.
4. Seed data patterns: routing conditions = array of {field, operator, value}; routing actions = flat object {assignTeamId, setPriority, ...}; automation conditions = array; automation actions = array of {type, value}.

### CASL Gates (All Correct in Existing Code)
- HELPDESK_AGENT: read HelpdeskMacro, read HelpdeskTeam, read HelpdeskSavedView
- HELPDESK_LEAD+: manage HelpdeskMacro, manage KbArticle, manage KbCategory
- HELPDESK_MANAGER: manage HelpdeskTeam, HelpdeskRoutingRule, HelpdeskSlaPolicy, HelpdeskAutomationRule, HelpdeskEmailConfig, HelpdeskSavedView

### Settings CASL Issue
- updateSettingAction (admin-settings.ts) requires `ability.can('update', 'Setting')` = ADMIN only
- Helpdesk settings page gates on `ability.can('manage', 'HelpdeskEmailConfig')` = HELPDESK_MANAGER
- Need helpdesk-specific settings action that restricts to `helpdesk.*` keys

### Sidebar Permission Strings
- Uses custom string-based permission system: "helpdesk.teams.view", "helpdesk.macros.view", etc.
- Separate from CASL — just for sidebar item visibility
- Computed from platformRoles in layout

### File Size Concerns
- helpdesk-agent.ts: 297 lines (AT LIMIT — no more additions)
- validations/helpdesk.ts: 168 lines (room for ~80 more lines of schemas)
- helpdesk-agent-config.test.ts: 255 lines (room for more tests but better to create new test file)
