---
name: G9.5 KB Completion Findings
description: Existing code state, gap analysis, and spec inconsistencies for G9.5 KB completion step
type: project
---

## G9.5 KB Completion — Findings (2026-03-16)

### What EXISTS (built by G9):
- Actions: createKbArticle, publishKbArticle, archiveKbArticle, submitForReview, createKbCategory, reorderKbCategories, linkArticleToCase, submitArticleFeedback (kb-articles.ts, 216 lines)
- Queries: getPublicKbCategories, getKbArticlesByCategory, getKbArticleBySlug, getFeaturedKbArticles, getAdminKbArticles (kb-articles.ts, 263 lines)
- Validation: createKbArticleSchema, createKbCategorySchema, submitArticleFeedbackSchema
- Pages: /kb (list), /kb/new, /kb/[id]/edit, /kb/categories, /h (home), /h/[cat]/[art], /h/contact
- Components: kb-article-editor.tsx (223 lines), article-feedback-form.tsx (104 lines)
- Tests: 24 tests across 3 test files + validation tests
- Seed: 8 categories, 12 articles with real Markdown body content
- CASL: KbArticle + KbCategory subjects, LEAD+ manage rules

### What's MISSING:
1. updateKbArticle action — editor always calls create even for edits
2. updateKbCategory action — no way to edit categories
3. deleteKbCategory action — no way to delete categories
4. Status transition buttons in editor — publish/review/archive actions exist but UI only has "Save Draft"
5. Help center search — input on /h is cosmetic (no onChange, no API, no results)
6. Markdown rendering — article body shown as whitespace-pre-wrap plaintext
7. searchKeywords field — not exposed in editor form
8. Category form — "New Category" button is non-functional plain button

### Key Schema Facts:
- kbCategory has `isActive` (NOT `isPublished`, NOT `audience`). Schema Doc authoritative.
- kbArticle does NOT have `isPublished`, `canonicalUrl`, `lastEditedById`. Schema Doc authoritative.
- kbArticleRelation uses `articleId` + `relatedArticleId` (NOT sourceArticleId/targetArticleId)
- kbArticleFeedback uses `helpful` (NOT `isHelpful`), `sessionFingerprint` (NOT sessionId+ipHash)

### File Size Concerns:
- kb-articles.ts (actions): 216 lines. Adding updateKbArticle pushes to ~306. MUST split.
- kb-articles.ts (queries): 263 lines. Adding searchKbArticles pushes to ~323. MUST split.
- kb-article-editor.tsx: 223 lines. Adding toolbar buttons pushes to ~300+. MUST extract toolbar.

### Search Implementation:
- Typesense NOT wired in codebase. All search uses DB ILIKE (searchListings pattern).
- KB search will also use DB ILIKE. Typesense kb_articles index defined in Schema Doc but deferred.
