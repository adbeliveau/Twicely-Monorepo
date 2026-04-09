# Canonical 37 -- KB Page Builder

**Status:** DRAFT (V4)
**Domain:** helpdesk, content-management
**Depends on:** Canonical 13 (Helpdesk), `packages/db/src/schema/kb.ts`, `packages/db/src/schema/helpdesk.ts`, `@twicely/casl`, `@twicely/search`, `@twicely/jobs`, `@twicely/ai`
**Package:** extends `packages/db/src/schema/kb.ts`, `apps/web/src/lib/actions/kb-*.ts`, `apps/web/src/components/admin/`

---

## 1. Purpose

Extend V3's existing Knowledge Base system with a rich content block editor, article versioning, draft/published workflow, policy documents, AI-powered article suggestions, article analytics, and embeddable help widgets. This is NOT a full page builder (that is V5/Puck for storefronts). This is focused exclusively on documentation content: help articles, policies, FAQs, guides, and announcements.

---

## 2. Core Principles

1. **Publishing never modifies the article row directly.** Publishing creates a `kbArticleVersion` snapshot, then updates the article's `body`, `bodyBlocksJson`, `version`, `publishedAt`, and `status` from the approved draft.
2. **Versions are immutable.** Once a `kbArticleVersion` row is created, it is never updated or deleted.
3. **The published article is always a specific version.** `kbArticle.version` corresponds to the latest published `kbArticleVersion.versionNumber`. The public-facing help center reads from the article row (not the version table).
4. **Policy documents use the same schema.** A policy document (`articleType = 'POLICY'`) is just a KB article with a different type flag. Same editor, same versioning, same workflow. Rendered at `/p/{slug}` instead of `/h/{category-slug}/{article-slug}`.
5. **Block content is validated on save.** Every block in `bodyBlocksJson` must conform to the `ContentBlock` Zod schema. Invalid blocks are rejected at the API layer.
6. **Body text is auto-generated from blocks.** When `bodyFormat = 'RICHTEXT'`, the plain `body` field is auto-populated as a text-only rendering (for search indexing and fallback). The blocks JSON is the source of truth for rich rendering.
7. **AI features are supplementary.** AI never auto-publishes or auto-modifies published content. AI generates drafts and suggestions that staff must review.

---

## 3. Schema (Drizzle pgTable)

All additions go in `packages/db/src/schema/kb.ts` (extend existing file).

### 3.1 `kbArticleVersion` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `articleId` | text, FK -> kbArticle.id (cascade) | |
| `versionNumber` | integer, not null | Monotonically increasing per article |
| `title` | text, not null | Title at time of version creation |
| `excerpt` | text, nullable | |
| `body` | text, not null | Plain text body at time of version |
| `bodyBlocksJson` | jsonb, nullable | Rich content blocks at time of version |
| `bodyFormat` | `kbBodyFormatEnum` | Format at time of version |
| `changeNote` | text, nullable | Optional note about what changed |
| `createdByStaffId` | text, not null | Staff who created this version |
| `status` | text, not null | Status at time of snapshot |
| `createdAt` | timestamptz | |

Indexes: `(articleId, versionNumber)` unique, `(articleId, createdAt)`.

### 3.2 `kbArticle` table extensions

Add columns to existing `kbArticle` table:

| Column | Type | Notes |
|---|---|---|
| `articleType` | `kbArticleTypeEnum` | `ARTICLE` (default), `POLICY`, `GUIDE`, `FAQ`, `ANNOUNCEMENT` |
| `bodyBlocksJson` | jsonb, nullable | Structured content blocks (when bodyFormat = RICHTEXT) |
| `draftBody` | text, nullable | In-progress draft body (not yet published) |
| `draftBlocksJson` | jsonb, nullable | In-progress draft blocks |
| `draftTitle` | text, nullable | In-progress draft title |
| `draftExcerpt` | text, nullable | In-progress draft excerpt |
| `scheduledPublishAt` | timestamptz, nullable | When to auto-publish |
| `lastPublishedByStaffId` | text, nullable | Staff who last published |
| `editLockedByStaffId` | text, nullable | Soft lock for single-author editing |
| `editLockedAt` | timestamptz, nullable | When the lock was acquired |
| `approvalRequired` | boolean, default false | If true, article must go through REVIEW before publish |
| `approvedByStaffId` | text, nullable | Staff who approved the review |
| `approvedAt` | timestamptz, nullable | When approved |

Enum to add to `enums.ts`:
```ts
export const kbArticleTypeEnum = pgEnum('kb_article_type', ['ARTICLE', 'POLICY', 'GUIDE', 'FAQ', 'ANNOUNCEMENT']);
```

### 3.3 `kbArticleAnalytics` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `articleId` | text, FK -> kbArticle.id (cascade) | |
| `date` | date, not null | Aggregation date |
| `pageViews` | integer, not null, default 0 | |
| `uniqueVisitors` | integer, not null, default 0 | |
| `helpfulYesCount` | integer, not null, default 0 | Helpful votes on this date |
| `helpfulNoCount` | integer, not null, default 0 | |
| `avgTimeOnPageSeconds` | integer, nullable | Average time spent reading |
| `searchClickCount` | integer, not null, default 0 | Clicked from search results |
| `caseDeflectionCount` | integer, not null, default 0 | User viewed article instead of opening a case |
| `createdAt` | timestamptz | |

Indexes: `(articleId, date)` unique, `(date)`.

### 3.4 `kbSearchLog` table (new)

Tracks search-to-article conversion for KB search quality analysis.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `query` | text, not null | Search query text |
| `resultCount` | integer, not null | Number of results returned |
| `clickedArticleId` | text, nullable, FK -> kbArticle.id (set null) | Article clicked from results |
| `userId` | text, nullable | Null for anonymous |
| `sessionFingerprint` | text, nullable | For anonymous dedup |
| `source` | text, not null, default `'help_center'` | `help_center`, `widget`, `agent_panel` |
| `createdAt` | timestamptz | |

Indexes: `(query, createdAt)`, `(clickedArticleId)`.

---

## 4. Content Block Schema

### 4.1 Block types

The `bodyBlocksJson` field stores an ordered array of content blocks. Each block has a `type` discriminator and type-specific `data`.

| Block Type | Description | Data Fields |
|---|---|---|
| `paragraph` | Rich text paragraph | `text: string` (with inline formatting marks) |
| `heading` | Section heading | `text: string`, `level: 2 | 3 | 4` (h1 reserved for page title) |
| `image` | Inline image | `url: string`, `alt: string`, `caption?: string`, `width?: number` |
| `callout` | Highlighted callout box | `text: string`, `variant: 'info' | 'warning' | 'success' | 'danger'` |
| `code` | Code block | `code: string`, `language?: string` |
| `list` | Ordered or unordered list | `items: string[]`, `ordered: boolean` |
| `divider` | Horizontal rule | (no data) |
| `table` | Simple table | `headers: string[]`, `rows: string[][]` |
| `embed` | YouTube/Loom/external embed | `url: string`, `provider?: string` |
| `faq` | FAQ accordion | `items: { question: string, answer: string }[]` |

### 4.2 Zod validation

File: `apps/web/src/lib/validations/kb-blocks.ts`

```ts
const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), data: z.object({ text: z.string().min(1).max(10000) }) }),
  z.object({ type: z.literal('heading'), data: z.object({ text: z.string().min(1).max(500), level: z.union([z.literal(2), z.literal(3), z.literal(4)]) }) }),
  z.object({ type: z.literal('image'), data: z.object({ url: z.string().url(), alt: z.string().max(500), caption: z.string().max(500).optional(), width: z.number().int().positive().optional() }) }),
  z.object({ type: z.literal('callout'), data: z.object({ text: z.string().min(1).max(5000), variant: z.enum(['info', 'warning', 'success', 'danger']) }) }),
  z.object({ type: z.literal('code'), data: z.object({ code: z.string().min(1).max(50000), language: z.string().max(50).optional() }) }),
  z.object({ type: z.literal('list'), data: z.object({ items: z.array(z.string().max(2000)).min(1).max(100), ordered: z.boolean() }) }),
  z.object({ type: z.literal('divider'), data: z.object({}) }),
  z.object({ type: z.literal('table'), data: z.object({ headers: z.array(z.string().max(500)).min(1).max(20), rows: z.array(z.array(z.string().max(2000))).min(1).max(200) }) }),
  z.object({ type: z.literal('embed'), data: z.object({ url: z.string().url(), provider: z.string().max(50).optional() }) }),
  z.object({ type: z.literal('faq'), data: z.object({ items: z.array(z.object({ question: z.string().min(1).max(500), answer: z.string().min(1).max(5000) })).min(1).max(50) }) }),
]);

const bodyBlocksSchema = z.array(contentBlockSchema).min(1).max(200);
```

---

## 5. Draft / Publish Workflow

### 5.1 States

```
DRAFT  -->  REVIEW  -->  PUBLISHED  -->  ARCHIVED
  ^           |              |
  |           v              v
  +------  (reject)    DRAFT (new version starts)
```

### 5.2 Draft editing

When a staff member edits a published article:
1. Changes go into the `draft*` columns (`draftBody`, `draftBlocksJson`, `draftTitle`, `draftExcerpt`).
2. The published article remains visible to the public with its current content.
3. The article `status` stays `PUBLISHED` while a draft exists. The editor shows a "Has unpublished changes" badge.

### 5.3 Publishing

When staff clicks "Publish":
1. If `approvalRequired` is true and article has not been approved, reject with error.
2. Create a `kbArticleVersion` snapshot of the current published state (before overwriting).
3. Copy `draft*` fields into the main article columns.
4. Increment `version`.
5. Set `publishedAt = now()`, `lastPublishedByStaffId = staffId`.
6. Clear `draft*` fields (set to null). Clear approval fields.
7. Set `status = 'PUBLISHED'`.
8. Enqueue `kb.search-reindex` job to update Typesense index.

### 5.4 Approval workflow

When `kb.article.approvalRequired` platform setting is `true`:
1. Author submits draft for review: `status` remains `PUBLISHED` (existing content stays live), but a review flag is set.
2. Lead/Admin reviews and either approves (`approvedByStaffId`, `approvedAt` set) or rejects (clears draft fields, notifies author).
3. Approved articles can be published.

### 5.5 Scheduled publishing

If `scheduledPublishAt` is set:
1. A BullMQ delayed job `kb.scheduled-publish` is enqueued.
2. When the job fires, it executes the publish logic from 5.3.
3. If the article was manually published or `scheduledPublishAt` was cleared before the job fires, the job is a no-op.

---

## 6. Version History

### 6.1 Viewing

`GET /api/kb/articles/[id]/versions` returns paginated list of versions with `versionNumber`, `createdByStaffId`, `changeNote`, `createdAt`.

### 6.2 Diff view

`GET /api/kb/articles/[id]/versions/[versionNumber]/diff` compares a version against the previous version (or current published content). Returns a unified diff of the plain text body.

### 6.3 Revert

`POST /api/kb/articles/[id]/revert/[versionNumber]` copies the selected version's content into the draft fields. Does NOT auto-publish. Staff must review and publish explicitly.

---

## 7. Edit Locking

### 7.1 Soft lock model

When a staff member opens an article for editing:
1. Set `editLockedByStaffId = staffId`, `editLockedAt = now()`.
2. If another staff member tries to edit, show a warning (soft lock, not hard block).
3. Lock expires after `kb.editLock.expiryMinutes` (default: 30).
4. Lock is released on explicit save, close, or navigation away.

---

## 8. Document Types

### 8.1 Article types

| Type | Public Route | Description |
|---|---|---|
| `ARTICLE` | `/h/{category-slug}/{article-slug}` | Standard KB help article |
| `POLICY` | `/p/{slug}` | Legal/policy document (ToS, Privacy, Buyer Protection) |
| `GUIDE` | `/h/{category-slug}/{article-slug}` | Long-form guide (same route, different styling) |
| `FAQ` | `/h/faq` or embedded | FAQ page using FAQ accordion blocks |
| `ANNOUNCEMENT` | `/h/announcements/{slug}` | Platform announcements with publish date |

### 8.2 Policy-specific behavior

- Policies are always `audience = 'ALL'` (public).
- Policies always show version number and `publishedAt` date in the footer.
- Policy version history is publicly accessible at `/p/{slug}/history`.

---

## 9. Search Integration (Typesense)

### 9.1 KB article index

Collection: `kb_articles` in Typesense.

Fields:
```ts
{ name: 'id', type: 'string' },
{ name: 'title', type: 'string' },
{ name: 'excerpt', type: 'string', optional: true },
{ name: 'body', type: 'string' },  // plain text for search
{ name: 'tags', type: 'string[]', facet: true },
{ name: 'categorySlug', type: 'string', facet: true, optional: true },
{ name: 'categoryName', type: 'string', optional: true },
{ name: 'articleType', type: 'string', facet: true },
{ name: 'audience', type: 'string', facet: true },
{ name: 'status', type: 'string', facet: true },
{ name: 'viewCount', type: 'int32', sort: true },
{ name: 'helpfulScore', type: 'int32', sort: true },  // helpfulYes - helpfulNo
{ name: 'publishedAt', type: 'int64', sort: true },
```

### 9.2 Search API

`GET /api/kb/search?q=...&category=...&type=...`

Returns results ranked by relevance. Filters: `articleType`, `categorySlug`, `audience`, `tags`. Public articles only (status = PUBLISHED, audience filter applied based on session role).

### 9.3 Agent-only search

Hub agents searching KB get `audience IN ('ALL', 'AGENT_ONLY')` results. Agents also see DRAFT and REVIEW articles (with badges).

---

## 10. AI Features

### 10.1 Auto-suggest related articles

When an agent is composing a helpdesk case reply:
1. The agent panel calls `POST /api/kb/ai/suggest` with the case subject and last message.
2. The API calls Typesense with the extracted keywords to find top-5 relevant KB articles.
3. Returns article titles, slugs, and relevance scores.
4. Agent can link an article to the case (creates `kbCaseArticleLink`) or insert article content into the reply.

### 10.2 Draft generation from support tickets

When a helpdesk agent identifies a knowledge gap (no relevant KB article exists):
1. Agent clicks "Create KB article from case" on the case detail page.
2. The system calls `@twicely/ai` with the case messages to generate a draft article:
   - Extracts the problem description for the title.
   - Generates a structured body with problem, solution, and related steps.
   - Sets `articleType = 'ARTICLE'`, `status = 'DRAFT'`.
3. The draft is opened in the KB editor for staff review and editing.
4. This is a convenience feature -- never auto-publishes.

### 10.3 Article quality scoring

BullMQ job `kb.quality-score` runs weekly:
1. For each published article, compute a quality score based on:
   - Helpfulness ratio (`helpfulYes / (helpfulYes + helpfulNo)`)
   - View count trend (increasing, stable, declining)
   - Case deflection rate (from `kbArticleAnalytics.caseDeflectionCount`)
   - Staleness (days since last update)
2. Articles below the threshold (`kb.ai.qualityScoreThreshold`, default 40) are flagged for review.
3. Notification sent to article author: `kb.article.qualityAlert`.

---

## 11. Article Analytics

### 11.1 Data collection

On each public article page view:
1. Increment `kbArticle.viewCount`.
2. Insert/update `kbArticleAnalytics` row for today's date.
3. Track time-on-page via client-side `beforeunload` event (approximate, not exact).

### 11.2 Case deflection tracking

When a user views a KB article and does NOT open a helpdesk case in the same session (within 30 minutes), count as a deflection. Tracked via the `kbArticleAnalytics.caseDeflectionCount` column.

### 11.3 Analytics dashboard

Hub route: `/kb/analytics`

- Total views, unique visitors, helpfulness ratio (last 7/30/90 days).
- Top articles by views.
- Top articles by case deflections.
- Articles with declining views or low helpfulness scores.
- Search-to-article conversion rate (from `kbSearchLog`).

---

## 12. Embeddable KB Widgets

### 12.1 In-app help widget

A floating help button in the marketplace UI that opens a compact KB search panel:
- Search input with Typesense autocomplete.
- Top-5 results shown inline.
- Click to expand article in a slide-over panel (no full page navigation).
- "Contact support" fallback link at the bottom.

Component: `apps/web/src/components/helpdesk/kb-help-widget.tsx`

### 12.2 Contextual help

Page-specific help articles can be embedded via a `HelpTooltip` component:
```tsx
<HelpTooltip articleSlug="how-to-list-an-item" />
```

This renders a `?` icon that opens a popover with the article's excerpt and a "Read more" link.

### 12.3 Widget rendering

Widgets only display PUBLISHED articles with `audience = 'ALL'` (or matching the user's role). No DRAFT or AGENT_ONLY articles in widgets.

---

## 13. Public Site Rendering

### 13.1 Article pages (`/h/[category-slug]/[article-slug]`)

- If `bodyFormat = 'RICHTEXT'` and `bodyBlocksJson` is not null: render blocks.
- If `bodyFormat = 'MARKDOWN'`: render markdown.
- If `bodyFormat = 'HTML'`: render sanitized HTML.
- Fallback: render `body` as plain text.

### 13.2 Policy pages (`/p/[slug]`)

Same rendering as article pages. Additional footer: "Last updated: {publishedAt}, Version {version}". Link to version history.

### 13.3 Block renderer

Component: `apps/web/src/components/helpdesk/kb-block-renderer.tsx`

Maps each block type to HTML/React:
- `paragraph` -> `<p>` with inline formatting
- `heading` -> `<h2>`/`<h3>`/`<h4>` with anchor IDs for deep linking
- `image` -> `<figure>` with `<img>` and optional `<figcaption>`
- `callout` -> colored box (info=blue, warning=yellow, success=green, danger=red)
- `code` -> `<pre><code>` with syntax highlighting
- `list` -> `<ul>` or `<ol>`
- `divider` -> `<hr>`
- `table` -> `<table>` with header row
- `embed` -> `<iframe>` (allowlist from `kb.embed.allowedDomains`)
- `faq` -> `<details>` / `<summary>` accordion

---

## 14. RBAC

| Subject | Actions | Who |
|---|---|---|
| `KbArticle` | `read` | ALL (public), AGENT_ONLY (agent articles) |
| `KbArticle` | `create` | HELPDESK_LEAD+, ADMIN |
| `KbArticle` | `update` (edit draft) | HELPDESK_AGENT+ (own drafts), HELPDESK_LEAD+ (any) |
| `KbArticle` | `update` (publish) | HELPDESK_LEAD+, ADMIN |
| `KbArticle` | `update` (approve) | HELPDESK_LEAD+, ADMIN |
| `KbArticle` | `delete` | ADMIN |
| `KbArticleVersion` | `read` | HELPDESK_AGENT+, ADMIN |
| `KbCategory` | `create`, `update`, `delete` | HELPDESK_LEAD+, ADMIN |
| `KbArticleAnalytics` | `read` | HELPDESK_AGENT+, ADMIN |

---

## 15. Platform Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `kb.editLock.expiryMinutes` | integer | 30 | Edit lock auto-expiry |
| `kb.blocks.maxPerArticle` | integer | 200 | Max content blocks per article |
| `kb.version.maxPerArticle` | integer | 100 | Max versions retained per article |
| `kb.scheduledPublish.enabled` | boolean | true | Enable scheduled publishing |
| `kb.article.approvalRequired` | boolean | false | Require approval before publish |
| `kb.policy.publicVersionHistory` | boolean | true | Show version history on policy pages |
| `kb.embed.allowedDomains` | string | `youtube.com,loom.com,vimeo.com` | Comma-separated embed allowlist |
| `kb.ai.suggestEnabled` | boolean | true | Enable AI article suggestions for agents |
| `kb.ai.draftGenerationEnabled` | boolean | false | Enable AI draft generation from cases |
| `kb.ai.qualityScoreEnabled` | boolean | false | Enable automated quality scoring |
| `kb.ai.qualityScoreThreshold` | integer | 40 | Quality score below which articles are flagged |
| `kb.analytics.timeOnPageEnabled` | boolean | true | Track time-on-page |
| `kb.widget.enabled` | boolean | true | Enable in-app help widget |

---

## 16. BullMQ Jobs

| Job | Queue | Trigger | Description |
|---|---|---|---|
| `kb.scheduled-publish` | `kb` | Delayed job from schedule API | Publishes article at scheduled time |
| `kb.search-reindex` | `kb` | After any publish | Reindexes article in Typesense |
| `kb.quality-score` | `kb` | Weekly cron (`0 6 * * 1`) | Scores all published articles |
| `kb.analytics-aggregate` | `kb` | Daily cron (`0 2 * * *`) | Aggregates daily analytics |

---

## 17. Out of Scope

- Puck page builder (V5 for storefronts, POWER+ tier only)
- Drag-and-drop visual editor (blocks are authored via a structured editor, not WYSIWYG)
- Multi-author concurrent editing (single-author locking model)
- A/B testing of article content
- Automated translation (i18n is a separate concern)
- External CMS integration (Contentful, Sanity)
- Article comments or discussion threads
