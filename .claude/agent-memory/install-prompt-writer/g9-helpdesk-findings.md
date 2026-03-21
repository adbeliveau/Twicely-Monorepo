---
name: G9 Helpdesk Findings
description: Schema gaps, existing code state, and spec inconsistencies for G9 Helpdesk + Knowledge Base
type: project
---

## G9 Helpdesk + Knowledge Base — Existing Code State (2026-03-15)

### Schema Files EXIST (schema-only, no business logic):
- `helpdesk.ts` (219 lines): 13 helpdesk tables
- `kb.ts` (103 lines): 5 KB tables
- All 9 enums in `enums.ts` (lines 138-150)

### CASL State:
- `HelpdeskCase` subject EXISTS in subjects.ts (line 16)
- Buyer abilities: read (own) + create HelpdeskCase
- Platform abilities: manage HelpdeskCase for all staff
- System role defaults: AGENT (read/create/update), LEAD (+delete), MANAGER (+delete)
- MISSING subjects: KbArticle, KbCategory, HelpdeskTeam, HelpdeskMacro, HelpdeskSavedView, etc.

### Skeleton Pages EXIST (placeholders only):
- `/hd/page.tsx` — 3 stat cards + "launching soon"
- `/kb/page.tsx` — 3 stat cards + "launching soon"
- `/h/page.tsx` — "Content coming soon"
- `/h/contact/page.tsx` — "email support@twicely.co"
- `/h/[category-slug]/page.tsx` — placeholder per category
- `/h/[category-slug]/[article-slug]/page.tsx` — exists

### Admin nav entries EXIST:
- Helpdesk: `{ href: '/hd', roles: ['HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN'] }`
- KB: `{ href: '/kb', roles: ['HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN'] }`

### Does NOT exist:
- No actions, queries, or business logic
- No notification templates for helpdesk
- No platform settings seeded for helpdesk
- No seed data (teams, SLA, routing, automation, KB categories)
- No `/my/support/*` pages
- No helpdesk layout
- No background jobs

### Spec Inconsistencies (Schema Doc v2.1.0 vs Helpdesk Canonical §25):
1. helpdeskCase: Schema Doc simpler (no lastActivityAt, emailThreadId, etc.). Canonical richer.
2. caseMessage: Schema Doc uses senderType/senderId/senderName. Canonical uses authorId/authorName/authorEmail/authorType + isInternal.
3. caseEvent: Schema Doc uses dataJson. Canonical has description, oldValue, newValue, metaJson.
4. kbCategory: Schema Doc has isActive. Canonical has isPublished + audience + SEO fields.
5. helpdeskRoutingRule: Schema Doc uses generic actionsJson. Canonical has structured columns (assignTeamId, setPriority, etc.).
6. Actors/Security Canonical uses `/helpdesk/*` routes BUT Page Registry corrects to `/hd/*`. Use `/hd/*`.

**Why:** Schema Doc (v2.1.0) is authoritative for DB. Canonical §25 is a "sketch" that was written before final schema lock.
**How to apply:** Use Schema Doc columns as-is. Only add columns that are truly needed (lastActivityAt for queue sorting). Don't restructure existing columns.
