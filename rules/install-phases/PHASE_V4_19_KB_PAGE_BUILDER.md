# V4 Install Phase 19 -- KB Page Builder

**Status:** DRAFT (V4)
**Prereq:** V3 KB system operational (kbArticle, kbCategory tables, CRUD actions, public help center at `/h/*`, editor at `/kb/*`), BullMQ operational, Typesense connected
**Canonical:** `rules/canonicals/37_KB_PAGE_BUILDER.md`
**V2 lineage:** None (new in V4, extends V3 helpdesk KB)
**Estimated steps:** 10

---

## 0) What This Phase Installs

### Backend
- `kbArticleVersion`, `kbArticleAnalytics`, `kbSearchLog` tables (Drizzle)
- 10+ new columns on existing `kbArticle` table (articleType, bodyBlocksJson, draft*, scheduled*, lock*, approval*)
- `kbArticleTypeEnum` enum
- Content block Zod validation schema (10 block types)
- Draft/publish workflow with version snapshots
- Edit locking service (soft lock, 30-minute expiry)
- Scheduled publishing via BullMQ delayed jobs
- Article version history with revert capability
- AI features: article suggestion for agents, draft generation from cases, quality scoring
- Article analytics collection + aggregation
- Search-to-article tracking (kbSearchLog)
- KB Typesense index for article search
- Embeddable help widget component
- Policy document rendering at `/p/*`

### Hub UI
- `/kb/[id]/versions` -- Version history with diff view
- `/kb/[id]/preview` -- Draft preview
- `/kb/analytics` -- Article analytics dashboard
- `/kb/new` + `/kb/[id]/edit` -- Block editor integration, article type selector, draft indicator, lock warning

### Public UI
- `/h/[category-slug]/[article-slug]` -- Block renderer for RICHTEXT articles
- `/p/[slug]` -- Policy document page with version footer
- `/p/[slug]/history` -- Public policy version history
- `/p` -- Policy list page
- `/h/announcements/[slug]` -- Announcement pages
- In-app help widget (floating search panel)
- `<HelpTooltip>` contextual help component

### Seed Data
- All `kb.*` platform settings keys

---

## 1) Schema (Drizzle)

### Files

| File | Action |
|---|---|
| `packages/db/src/schema/enums.ts` | MODIFY (add kbArticleTypeEnum) |
| `packages/db/src/schema/kb.ts` | MODIFY (add 3 tables, 12 columns to kbArticle) |
| `packages/db/src/schema/index.ts` | MODIFY (export new tables) |

### Step 1.1: Enum

```ts
export const kbArticleTypeEnum = pgEnum('kb_article_type', ['ARTICLE', 'POLICY', 'GUIDE', 'FAQ', 'ANNOUNCEMENT']);
```

### Step 1.2: `kbArticleVersion` table

```ts
export const kbArticleVersion = pgTable('kb_article_version', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  articleId:         text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  versionNumber:     integer('version_number').notNull(),
  title:             text('title').notNull(),
  excerpt:           text('excerpt'),
  body:              text('body').notNull(),
  bodyBlocksJson:    jsonb('body_blocks_json'),
  bodyFormat:        kbBodyFormatEnum('body_format').notNull(),
  changeNote:        text('change_note'),
  status:            text('status').notNull(),
  createdByStaffId:  text('created_by_staff_id').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleVersionIdx: unique().on(table.articleId, table.versionNumber),
  articleDateIdx:    index('kbav_article_date').on(table.articleId, table.createdAt),
}));
```

### Step 1.3: `kbArticleAnalytics` table

```ts
export const kbArticleAnalytics = pgTable('kb_article_analytics', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  articleId:             text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  date:                  date('date').notNull(),
  pageViews:             integer('page_views').notNull().default(0),
  uniqueVisitors:        integer('unique_visitors').notNull().default(0),
  helpfulYesCount:       integer('helpful_yes_count').notNull().default(0),
  helpfulNoCount:        integer('helpful_no_count').notNull().default(0),
  avgTimeOnPageSeconds:  integer('avg_time_on_page_seconds'),
  searchClickCount:      integer('search_click_count').notNull().default(0),
  caseDeflectionCount:   integer('case_deflection_count').notNull().default(0),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleDateIdx:        uniqueIndex('kban_article_date').on(table.articleId, table.date),
  dateIdx:               index('kban_date').on(table.date),
}));
```

### Step 1.4: `kbSearchLog` table

```ts
export const kbSearchLog = pgTable('kb_search_log', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  query:               text('query').notNull(),
  resultCount:         integer('result_count').notNull(),
  clickedArticleId:    text('clicked_article_id').references(() => kbArticle.id, { onDelete: 'set null' }),
  userId:              text('user_id'),
  sessionFingerprint:  text('session_fingerprint'),
  source:              text('source').notNull().default('help_center'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  queryDateIdx:        index('kbsl_query_date').on(table.query, table.createdAt),
  clickedArticleIdx:   index('kbsl_clicked').on(table.clickedArticleId),
}));
```

### Step 1.5: `kbArticle` table extensions

Add to existing `kbArticle` table:

```ts
articleType:            kbArticleTypeEnum('article_type').notNull().default('ARTICLE'),
bodyBlocksJson:         jsonb('body_blocks_json'),
draftBody:              text('draft_body'),
draftBlocksJson:        jsonb('draft_blocks_json'),
draftTitle:             text('draft_title'),
draftExcerpt:           text('draft_excerpt'),
scheduledPublishAt:     timestamp('scheduled_publish_at', { withTimezone: true }),
lastPublishedByStaffId: text('last_published_by_staff_id'),
editLockedByStaffId:    text('edit_locked_by_staff_id'),
editLockedAt:           timestamp('edit_locked_at', { withTimezone: true }),
approvalRequired:       boolean('approval_required').notNull().default(false),
approvedByStaffId:      text('approved_by_staff_id'),
approvedAt:             timestamp('approved_at', { withTimezone: true }),
```

### Step 1.6: Exports + migration

```bash
cd packages/db && npx drizzle-kit generate --name kb_page_builder_v4_19
```

---

## 2) Content Block Validation

### Step 2.1: Zod schema

File: `apps/web/src/lib/validations/kb-blocks.ts`

10 block types defined as a Zod discriminated union (see canonical section 4.2 for exact schema):
- `paragraph`, `heading`, `image`, `callout`, `code`, `list`, `divider`, `table`, `embed`, `faq`

Exports: `contentBlockSchema`, `bodyBlocksSchema` (array, min 1, max 200), `ContentBlock` type.

### Step 2.2: Blocks-to-plain-text utility

File: `apps/web/src/lib/services/kb-block-utils.ts`

```ts
export function blocksToPlainText(blocks: ContentBlock[]): string
// Converts block array to plain text for search indexing + body fallback
// paragraph/heading -> text
// list -> items joined with newlines
// table -> headers + rows flattened
// faq -> questions + answers
// code/callout -> content text
// embed/image/divider -> skip
```

### Step 2.3: Tests

File: `apps/web/src/lib/validations/__tests__/kb-blocks.test.ts` (12 tests)

1. Valid paragraph passes
2. Valid heading level 2/3/4 passes
3. Invalid heading level 1 or 5 fails
4. Valid image with url + alt passes
5. Image without url fails
6. Valid callout with variant passes
7. Invalid callout variant fails
8. Valid code block passes
9. Valid list block passes
10. Valid table block passes
11. Valid faq block passes
12. Array over max 200 blocks fails

---

## 3) Draft/Publish Workflow

### Step 3.1: Versioning service

File: `apps/web/src/lib/services/kb-versioning.ts`

```ts
export async function saveDraft(articleId: string, staffId: string, fields: {
  title?: string; excerpt?: string; body?: string; bodyBlocksJson?: ContentBlock[];
}): Promise<void>
// If bodyFormat='RICHTEXT' and blocks provided: validate with bodyBlocksSchema
// Auto-generate draftBody from blocks via blocksToPlainText()
// Save to draft* columns

export async function publishArticle(
  articleId: string, staffId: string, changeNote?: string
): Promise<KbArticle>
// 1. If approvalRequired and not approved, reject
// 2. If published + version >= 1: create kbArticleVersion snapshot of current
// 3. Copy draft* -> main columns, clear draft*
// 4. Increment version, set publishedAt, lastPublishedByStaffId
// 5. Enqueue kb.search-reindex job

export async function revertToVersion(
  articleId: string, versionNumber: number, staffId: string
): Promise<void>
// Copy version content into draft* fields (not main). Staff must publish explicitly.

export async function getVersionHistory(articleId: string): Promise<VersionMeta[]>
export async function getVersion(articleId: string, versionNumber: number): Promise<KbArticleVersion>
```

### Step 3.2: Tests

File: `apps/web/src/lib/services/__tests__/kb-versioning.test.ts` (10 tests)

1. saveDraft stores fields without affecting published
2. saveDraft validates blocks for RICHTEXT
3. saveDraft auto-generates plain text from blocks
4. publishArticle creates version snapshot on re-publish
5. publishArticle copies draft to main
6. publishArticle clears draft fields
7. publishArticle increments version
8. First publish (version 1) creates no snapshot
9. revertToVersion copies to draft fields
10. getVersionHistory returns reverse order

---

## 4) Edit Locking

### Step 4.1: Lock service

File: `apps/web/src/lib/services/kb-edit-lock.ts`

```ts
export async function acquireLock(articleId: string, staffId: string): Promise<{
  acquired: boolean; lockedBy?: string; lockedAt?: Date;
}>
// Expired lock (editLockedAt + kb.editLock.expiryMinutes < now()) can be acquired

export async function releaseLock(articleId: string, staffId: string): Promise<void>

export async function overrideLock(articleId: string, staffId: string): Promise<void>
// Force-acquire, notify original holder, create audit event
```

### Step 4.2: Tests

File: `apps/web/src/lib/services/__tests__/kb-edit-lock.test.ts` (5 tests)

---

## 5) API Endpoints

### Step 5.1: Publish

`POST /api/kb/articles/[id]/publish` -- CASL: `update KbArticle` (HELPDESK_LEAD+)

### Step 5.2: Schedule

`POST /api/kb/articles/[id]/schedule` -- body: `{ publishAt: ISO8601 }`, enqueue BullMQ delayed job
`DELETE /api/kb/articles/[id]/schedule` -- clear scheduledPublishAt

### Step 5.3: Version history

`GET /api/kb/articles/[id]/versions` -- paginated version list
`GET /api/kb/articles/[id]/versions/[versionNumber]` -- full version content
`GET /api/kb/articles/[id]/versions/[versionNumber]/diff` -- diff against previous version

### Step 5.4: Revert

`POST /api/kb/articles/[id]/revert/[versionNumber]` -- loads version into draft

### Step 5.5: Lock

`POST /api/kb/articles/[id]/lock` -- acquire lock
`DELETE /api/kb/articles/[id]/lock` -- release lock

### Step 5.6: Policy list (public)

`GET /api/kb/policies` -- published policies, no auth required

### Step 5.7: AI suggest (agents)

`POST /api/kb/ai/suggest` -- body: `{ subject: string, lastMessage: string }`, returns top-5 relevant articles via Typesense

### Step 5.8: AI draft from case

`POST /api/kb/ai/draft-from-case` -- body: `{ caseId: string }`, generates draft article from case messages via `@twicely/ai`

### Step 5.9: KB search with logging

`GET /api/kb/search?q=...` -- extend existing to log queries in `kbSearchLog`

### Step 5.10: Update existing CRUD

Modify `apps/web/src/lib/actions/kb-articles.ts`:
- `createKbArticle`: accept `articleType`, `bodyBlocksJson`
- `updateKbArticle`: accept draft fields, validate blocks for RICHTEXT

### Step 5.11: Tests

File: `apps/web/src/app/api/kb/__tests__/kb-publish-api.test.ts` (10 tests)

1. POST /publish creates version and publishes
2. POST /publish without HELPDESK_LEAD+ returns 403
3. POST /publish rejects if approvalRequired and not approved
4. POST /schedule sets scheduledPublishAt
5. DELETE /schedule clears scheduledPublishAt
6. GET /versions returns version list
7. GET /versions/[n] returns version content
8. POST /revert loads version into draft
9. POST /lock acquires lock; DELETE releases
10. GET /policies returns only published policies

---

## 6) Typesense Search Integration

### Step 6.1: KB article Typesense collection

File: `apps/web/src/lib/services/kb-search.ts`

Collection: `kb_articles`

Fields: `id`, `title`, `excerpt`, `body` (plain text), `tags`, `categorySlug`, `categoryName`, `articleType`, `audience`, `status`, `viewCount`, `helpfulScore` (yes - no), `publishedAt`.

### Step 6.2: Index/reindex function

```ts
export async function indexKbArticle(articleId: string): Promise<void>
export async function removeKbArticleFromIndex(articleId: string): Promise<void>
export async function reindexAllKbArticles(): Promise<{ indexed: number }>
```

### Step 6.3: Search function

```ts
export async function searchKbArticles(query: string, opts?: {
  articleType?: string; categorySlug?: string; audience?: string[];
  limit?: number;
}): Promise<SearchResult[]>
```

---

## 7) AI Features

### Step 7.1: Article suggestions for agents

File: `apps/web/src/lib/services/kb-ai-suggest.ts`

```ts
export async function suggestArticles(input: {
  subject: string; lastMessage: string;
}): Promise<{ articleId: string; title: string; slug: string; score: number }[]>
// Extract keywords, search Typesense, return top-5
// Gate: kb.ai.suggestEnabled platform setting
```

### Step 7.2: Draft generation from cases

File: `apps/web/src/lib/services/kb-ai-draft.ts`

```ts
export async function generateDraftFromCase(caseId: string, staffId: string): Promise<string>
// 1. Load case messages
// 2. Call @twicely/ai to generate structured article draft
// 3. Create kbArticle with status=DRAFT, articleType=ARTICLE
// 4. Return articleId
// Gate: kb.ai.draftGenerationEnabled platform setting
```

### Step 7.3: Quality scoring

BullMQ weekly cron (`0 6 * * 1`), job: `kb.quality-score`

```ts
export async function scoreArticleQuality(): Promise<{ scored: number; flagged: number }>
// For each published article:
//   helpfulness = helpfulYes / (helpfulYes + helpfulNo)
//   viewTrend, deflectionRate, staleness
// Articles below kb.ai.qualityScoreThreshold (40) -> notify author
```

---

## 8) Article Analytics

### Step 8.1: Analytics collection

On each public article page view:
1. Increment `kbArticle.viewCount`
2. Upsert `kbArticleAnalytics` for today: increment `pageViews`, `uniqueVisitors` (session-based)
3. Log search click if referred from KB search (increment `searchClickCount`)

File: `apps/web/src/lib/services/kb-analytics.ts`

### Step 8.2: Case deflection tracking

When user views article and does NOT open helpdesk case within 30 minutes (tracked via session), count as deflection.

### Step 8.3: Analytics aggregation cron

BullMQ daily cron (`0 2 * * *`), job: `kb.analytics-aggregate`

Aggregates raw analytics data, computes daily summaries.

### Step 8.4: Analytics dashboard

Route: `apps/web/src/app/(hub)/kb/analytics/page.tsx`

- Total views, unique visitors, helpfulness ratio (7/30/90 days)
- Top articles by views
- Top articles by case deflections
- Articles with declining views or low helpfulness
- Search-to-article conversion rate

---

## 9) UI Pages

### Step 9.1: Block renderer (public)

File: `apps/web/src/components/helpdesk/kb-block-renderer.tsx`

Maps each block type to HTML/React (see canonical section 13.3).

### Step 9.2: Block editor (admin)

File: `apps/web/src/components/admin/kb-block-editor.tsx`

Client component: toolbar, block cards (drag-reorder, edit, delete), `value`/`onChange` props.
Split to sub-components if over 300 lines.

### Step 9.3: Article page updates

Modify `/h/[category-slug]/[article-slug]` page:
- RICHTEXT + bodyBlocksJson -> `<KbBlockRenderer>`
- MARKDOWN -> existing markdown renderer
- HTML -> sanitized HTML

### Step 9.4: Policy pages

- `/p/[slug]` -- policy document with version footer
- `/p/[slug]/history` -- public version history (gated by `kb.policy.publicVersionHistory`)
- `/p` -- policy list page

### Step 9.5: Announcement pages

- `/h/announcements/[slug]` -- announcement articles

### Step 9.6: Hub editor upgrades

- `/kb/new`: article type selector, block editor for RICHTEXT
- `/kb/[id]/edit`: draft indicator ("Has unpublished changes"), edit lock warning, publish button, version history sidebar
- `/kb/[id]/versions`: version list with diff view, revert button
- `/kb/[id]/preview`: renders draft as public page with "Preview" banner

### Step 9.7: In-app help widget

File: `apps/web/src/components/helpdesk/kb-help-widget.tsx`

Floating help button -> compact search panel with Typesense autocomplete, top-5 results inline, slide-over article view, "Contact support" fallback.

### Step 9.8: Contextual help tooltip

File: `apps/web/src/components/helpdesk/kb-help-tooltip.tsx`

```tsx
<HelpTooltip articleSlug="how-to-list-an-item" />
```

Renders `?` icon, popover with article excerpt, "Read more" link. Only PUBLISHED, audience=ALL articles.

### Step 9.9: Block editor tests

File: `apps/web/src/components/admin/__tests__/kb-block-editor.test.ts` (6 tests)

### Step 9.10: Block renderer tests

File: `apps/web/src/components/helpdesk/__tests__/kb-block-renderer.test.ts` (4 tests)

---

## 10) BullMQ Jobs + Seed + CASL + Final

### Step 10.1: BullMQ jobs

| Job | Queue | Trigger | Description |
|---|---|---|---|
| `kb.scheduled-publish` | `kb` | Delayed from schedule API | Publishes at scheduled time |
| `kb.search-reindex` | `kb` | After any publish | Reindexes in Typesense |
| `kb.quality-score` | `kb` | Weekly cron (Mon 06:00 UTC) | Scores all published articles |
| `kb.analytics-aggregate` | `kb` | Daily cron (02:00 UTC) | Aggregates daily analytics |

Register in `packages/jobs/src/cron-jobs.ts` with `tz: 'UTC'`.

### Step 10.2: Seed platform settings

All `kb.*` keys from canonical section 15 (13 keys total).

### Step 10.3: CASL

Add/extend in `packages/casl/src/subjects.ts`: `KbArticleVersion`, `KbArticleAnalytics`

Abilities per canonical section 14:
- ALL: read published KbArticle (public)
- HELPDESK_AGENT+: read KbArticleVersion, read KbArticleAnalytics, update KbArticle (own drafts)
- HELPDESK_LEAD+: create/update/publish KbArticle, manage KbCategory
- ADMIN: delete KbArticle, all permissions

### Step 10.4: Tests summary

| File | Min Tests |
|---|---|
| `apps/web/src/lib/validations/__tests__/kb-blocks.test.ts` | 12 |
| `apps/web/src/lib/services/__tests__/kb-versioning.test.ts` | 10 |
| `apps/web/src/lib/services/__tests__/kb-edit-lock.test.ts` | 5 |
| `apps/web/src/app/api/kb/__tests__/kb-publish-api.test.ts` | 10 |
| `apps/web/src/lib/services/__tests__/kb-scheduled-publish.test.ts` | 4 |
| `apps/web/src/lib/queries/__tests__/kb-article-type-filter.test.ts` | 3 |
| `apps/web/src/components/admin/__tests__/kb-block-editor.test.ts` | 6 |
| `apps/web/src/components/helpdesk/__tests__/kb-block-renderer.test.ts` | 4 |
| `apps/web/src/lib/services/__tests__/kb-ai-suggest.test.ts` | 4 |
| `apps/web/src/lib/services/__tests__/kb-analytics.test.ts` | 5 |
| `apps/web/src/lib/services/__tests__/kb-search.test.ts` | 4 |
| **Total** | **67** |

### Step 10.5: Doctor checks

- kbArticleVersion table writable (insert + delete test)
- Content block validation accepts valid paragraph, rejects invalid
- blocksToPlainText produces non-empty text
- Typesense kb_articles collection exists (or can be created)
- Platform settings present for all `kb.*` keys

### Completion Criteria

- [ ] 3 new tables created, 12+ columns added to kbArticle, 1 enum added
- [ ] Migration generated and applied
- [ ] 10 content block types validate via Zod
- [ ] blocksToPlainText utility functional
- [ ] Draft/publish workflow works end-to-end (save draft -> publish -> version snapshot)
- [ ] Version history records every publish
- [ ] Revert loads version content into draft (not auto-publish)
- [ ] Edit locking prevents concurrent edits (soft lock, 30-min expiry)
- [ ] Scheduled publishing works via BullMQ delayed job
- [ ] Approval workflow gates publishing when kb.article.approvalRequired = true
- [ ] Block editor renders in hub (add, remove, reorder blocks)
- [ ] Block renderer displays all 10 block types on public pages
- [ ] Policy pages render at `/p/{slug}` with version footer
- [ ] Policy version history publicly accessible
- [ ] AI article suggestions return relevant results for agents
- [ ] AI draft generation creates DRAFT article from case
- [ ] Article analytics collected on page views
- [ ] KB search logs queries in kbSearchLog
- [ ] Analytics dashboard shows views, deflections, helpfulness
- [ ] In-app help widget functional (search, results, slide-over)
- [ ] Typesense kb_articles index created and populated
- [ ] All 13 `kb.*` platform settings seeded
- [ ] CASL subjects and abilities correct
- [ ] 67+ new tests passing
- [ ] All existing KB tests still pass
- [ ] `npx turbo typecheck` -- 0 errors
- [ ] `npx turbo test` -- baseline maintained or increased
