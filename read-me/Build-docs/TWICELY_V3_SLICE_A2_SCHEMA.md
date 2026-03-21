# TWICELY V3 — Phase A2: Database Schema Migration

**Slice:** A2  
**Prerequisite:** A1 complete and verified  
**Goal:** Translate TWICELY_V3_SCHEMA.md into Drizzle schema code files. All 93 tables, all 55 enums. Push to database. TypeScript compiles clean.  
**Estimated files:** 23 (22 schema files + updated drizzle config)

---

## OWNER DIRECTIVES — FROM ADRIAN

1. **All 93 tables at once.** Forward references between tables make partial schemas painful. The schema is locked. Push everything.

2. **`src/lib/db/schema/index.ts` is a placeholder.** It currently contains `export {};` from A1. Replace it with real barrel exports.

3. **Write the plan FIRST. Do NOT start coding.** Before you write a single line of schema code, present:
   - The complete file list (every schema file you'll create, with full path and one-line description)
   - The step-by-step execution plan with verification commands after each step
   - Confirmation that seed data is NOT part of A2 (seeding is A5)
   
   Post the plan. Wait for approval. Only then start writing code.

4. **No seed data in A2.** Seeding is Phase A5. Do not create seed files, seed scripts, or demo data. A2 is schema code only.

5. **The project root is `C:\Users\XPS-15\Projects\Twicely`.** Not a subfolder. Not `twicely-v3`. Not `Twicely/v3`. The root. All file paths in this prompt are relative to this root.

---

## CRITICAL RULES — READ BEFORE WRITING ANY CODE

1. **COPY THE SCHEMA EXACTLY.** Every table, column, enum, index, and default in `TWICELY_V3_SCHEMA.md` must appear in code **character-for-character**. Do not rename columns. Do not add columns. Do not remove columns. Do not change types. Do not change defaults. If the schema says `text('id').primaryKey()`, you write `text('id').primaryKey()`. Not `varchar`, not `uuid`, not anything else.

2. **DO NOT INVENT.** If a column, table, enum value, index, or default is not in `TWICELY_V3_SCHEMA.md`, it does not exist. Do not add "helpful" fields. Do not add `updatedAt` to tables that don't have it in the spec (some tables intentionally omit it). Do not add relations — Drizzle relations are Phase A3's concern.

3. **USE THESE EXACT IMPORTS.** Every schema file starts with what it needs from these:
```typescript
import { pgTable, text, integer, boolean, timestamp, jsonb, pgEnum,
         index, unique, uniqueIndex, real, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
```
Plus imports from `./enums` for enum references, and imports from other schema files for foreign key references.

4. **NO `as any`. NO `@ts-ignore`. NO `as unknown as T`.** If TypeScript complains, fix the type. Do not cast.

5. **NO FILE OVER 300 LINES.** If a file approaches 300, it's already split correctly per the file plan below.

6. **DO NOT CREATE FILES NOT IN THE FILE LIST.** No utility files, no type files, no helper files, no "relation" files. Only the 23 files listed below.

7. **BARREL EXPORT EVERYTHING.** `src/lib/db/schema/index.ts` re-exports every enum and every table from every file. Nothing else.

8. **THE SCHEMA DOC IS LAW.** When in doubt, open `TWICELY_V3_SCHEMA.md` and copy verbatim. Do not paraphrase. Do not "improve."

---

## PROJECT CONTEXT

⚠️ **THE PROJECT ROOT IS `C:\Users\XPS-15\Projects\Twicely` — NOT a subfolder.** There is no `twicely-v3` folder. There is no `v3` folder. There is no nested project directory. The `package.json` is at `C:\Users\XPS-15\Projects\Twicely\package.json`. The `src` folder is at `C:\Users\XPS-15\Projects\Twicely\src`. "V3" is a planning label in document names only — it does NOT appear in any folder name, file path, import, package name, or database name.

- **Project root:** `C:\Users\XPS-15\Projects\Twicely` (this IS the root — no subfolder)
- **Package name:** `twicely` (no "v3" anywhere in code)
- **Database name:** `twicely`
- **ORM:** Drizzle ORM (NOT Prisma)
- **Node/pnpm:** Use pnpm for all installs
- **TypeScript:** strict:true, skipLibCheck:true
- **Existing from A1:** `src/lib/db/index.ts` (db connection), `src/lib/db/schema/index.ts` (empty barrel), `drizzle.config.ts`
- **Required package:** `@paralleldrive/cuid2` — install if not present

---

## FILE PLAN — 23 FILES

All schema files go in `src/lib/db/schema/`. Create or replace these files:

| # | File | What | Source (SCHEMA.md §) | Approx Lines |
|---|------|------|---------------------|-------------|
| 1 | `enums.ts` | All 55 pgEnum declarations | §1.1–§1.13 | ~180 |
| 2 | `auth.ts` | user, session, account, verification | §2.1–§2.2 | ~120 |
| 3 | `identity.ts` | sellerProfile, businessInfo, address | §2.3–§2.5 | ~130 |
| 4 | `staff.ts` | staffUser, staffUserRole, staffSession | §2.6–§2.8 | ~100 |
| 5 | `subscriptions.ts` | storeSubscription, listerSubscription, automationSubscription, delegatedAccess | §3.1–§3.4 | ~130 |
| 6 | `catalog.ts` | category, categoryAttributeSchema | §4.1–§4.2 | ~80 |
| 7 | `listings.ts` | listing, listingImage, listingOffer, listingFee, listingVersion, shippingProfile | §5.1–§5.6 | ~280 |
| 8 | `commerce.ts` | cart, cartItem, order, orderItem, orderPayment | §6.1–§6.5 | ~230 |
| 9 | `shipping.ts` | shipment, returnRequest, dispute | §7.1–§7.3 | ~200 |
| 10 | `reviews.ts` | review, reviewResponse, sellerPerformance | §8.1–§8.3 | ~120 |
| 11 | `messaging.ts` | conversation, message | §9.1–§9.2 | ~70 |
| 12 | `notifications.ts` | notification, notificationPreference, notificationTemplate | §10.1–§10.3 | ~100 |
| 13 | `finance.ts` | ledgerEntry, sellerBalance, payoutBatch, payout, feeSchedule, reconciliationReport, manualAdjustment | §11.1–§11.7 | ~220 |
| 14 | `crosslister.ts` | crosslisterAccount, channelProjection, crossJob, importBatch, importRecord, dedupeFingerprint, channelCategoryMapping, channelPolicyRule, automationSetting | §12.1–§12.9 | ~290 |
| 15 | `helpdesk.ts` | helpdeskCase + 12 supporting tables | §13.1–§13.13 | ~290 |
| 16 | `kb.ts` | kbCategory, kbArticle, kbArticleAttachment, kbArticleRelation, kbCaseArticleLink, kbArticleFeedback | §13.14–§13.19 | ~140 |
| 17 | `platform.ts` | platformSetting, platformSettingHistory, featureFlag, auditEvent, sequenceCounter, customRole, staffUserCustomRole | §14.1–§14.7 | ~170 |
| 18 | `providers.ts` | providerAdapter, providerInstance, providerSecret, providerUsageMapping, providerHealthLog | §14.8–§14.12 | ~180 |
| 19 | `promotions.ts` | promotion, promotionUsage, promotedListing | §15.1–§15.3 | ~110 |
| 20 | `social.ts` | follow, watchlistItem, savedSearch | §16.1–§16.3 | ~70 |
| 21 | `tax.ts` | taxInfo, taxQuote | §17.1–§17.2 | ~70 |
| 22 | `index.ts` | Barrel re-export of all above files | — | ~25 |
| 23 | `drizzle.config.ts` | Update if schema path changed | — | ~15 |

**Total: 93 tables, 55 enums, 22 schema files + 1 config update.**

---

## STEP-BY-STEP EXECUTION

### Step 0: Present plan for approval (MANDATORY — DO THIS FIRST)

Before writing ANY code, present to Adrian:
1. The complete list of files you will create (path + one-line description)
2. The order you will create them
3. What package(s) you need to install
4. Confirmation: "No seed data, no relations, no type exports, no migration files"

**STOP AND WAIT for Adrian's approval before proceeding to Step 1.**

### Step 1: Install dependency

```bash
pnpm add @paralleldrive/cuid2
```

Verify it installed. Show output.

### Step 2: Create `enums.ts`

Create `src/lib/db/schema/enums.ts` with ALL 55 pgEnum declarations from SCHEMA.md §1.1 through §1.13.

**Copy these sections verbatim:**
- §1.1 Identity & Auth: sellerTypeEnum, sellerStatusEnum, businessTypeEnum, platformRoleEnum, delegationStatusEnum
- §1.2 Subscriptions: storeTierEnum, listerTierEnum, performanceBandEnum, subscriptionStatusEnum
- §1.3 Listings: listingStatusEnum, listingConditionEnum, enforcementStateEnum
- §1.4 Commerce: cartStatusEnum, offerStatusEnum, orderStatusEnum, cancelInitiatorEnum
- §1.5 Shipping: shipmentStatusEnum
- §1.6 Returns & Disputes: returnStatusEnum, returnReasonEnum, returnFaultEnum, disputeStatusEnum, claimTypeEnum
- §1.7 Reviews: reviewStatusEnum, buyerQualityTierEnum
- §1.8 Messaging & Notifications: conversationStatusEnum, notificationChannelEnum, notificationPriorityEnum
- §1.9 Finance: ledgerEntryTypeEnum, ledgerEntryStatusEnum, payoutStatusEnum, payoutBatchStatusEnum, feeBucketEnum
- §1.10 Crosslister: channelEnum, authMethodEnum, accountStatusEnum, channelListingStatusEnum, publishJobStatusEnum, publishJobTypeEnum, importBatchStatusEnum
- §1.11 Helpdesk & KB: caseTypeEnum, caseStatusEnum, casePriorityEnum, caseChannelEnum, caseMessageDirectionEnum, caseMessageDeliveryStatusEnum, kbArticleStatusEnum, kbAudienceEnum, kbBodyFormatEnum
- §1.12 Promotions & Infrastructure: promotionTypeEnum, promotionScopeEnum, auditSeverityEnum, featureFlagTypeEnum
- §1.13 Provider System: providerAdapterSourceEnum, providerServiceTypeEnum, providerInstanceStatusEnum

**Count after this step: 55 enums. Verify the count.**

### Step 3: Create table schema files (files 2–21)

Create each file one at a time. For each file:
1. Add the necessary imports from `drizzle-orm/pg-core`, `drizzle-orm`, and `@paralleldrive/cuid2`
2. Import required enums from `./enums`
3. Import referenced tables from other schema files (for foreign keys)
4. Copy the table definitions EXACTLY from SCHEMA.md
5. Export every table

**IMPORT ORDER MATTERS.** Create files in this order to avoid circular references:

1. `enums.ts` — no dependencies
2. `auth.ts` — depends on enums only
3. `identity.ts` — depends on enums, auth (user)
4. `staff.ts` — depends on enums
5. `catalog.ts` — depends on enums
6. `platform.ts` — depends on enums, staff (for FK references — but staffUser FK is text-only, no import needed if not using `.references()` to a table in another file... **WAIT — check the schema**)

**FOREIGN KEY HANDLING:**

The schema uses `.references(() => tableName.id)` extensively. This creates cross-file dependencies. Handle this as follows:

- If table A references table B and both are in the SAME file → normal reference
- If table A references table B in a DIFFERENT file → import table B from that file

**Known cross-file references (from the schema):**
- `session.userId` → `user.id` (auth.ts self-ref ✅)
- `account.userId` → `user.id` (auth.ts self-ref ✅)
- `sellerProfile.userId` → `user.id` (identity.ts → auth.ts)
- `businessInfo.userId` → `user.id` (identity.ts → auth.ts)
- `address.userId` → `user.id` (identity.ts → auth.ts)
- `storeSubscription.sellerProfileId` → `sellerProfile.id` (subscriptions.ts → identity.ts)
- `listerSubscription.sellerProfileId` → `sellerProfile.id` (subscriptions.ts → identity.ts)
- `automationSubscription.sellerProfileId` → `sellerProfile.id` (subscriptions.ts → identity.ts)
- `delegatedAccess.sellerId` → `sellerProfile.id` (subscriptions.ts → identity.ts)
- `delegatedAccess.userId` → `user.id` (subscriptions.ts → auth.ts)
- `categoryAttributeSchema.categoryId` → `category.id` (catalog.ts self-ref ✅)
- `listing.ownerUserId` → `user.id` (listings.ts → auth.ts)
- `listing.categoryId` → `category.id` (listings.ts → catalog.ts)
- `listingImage.listingId` → `listing.id` (listings.ts self-ref ✅)
- `listingOffer.listingId` → `listing.id` (listings.ts self-ref ✅)
- `listingOffer.buyerId` → `user.id` (listings.ts → auth.ts)
- `listingFee.listingId` → `listing.id` (listings.ts self-ref ✅)
- `listingVersion.listingId` → `listing.id` (listings.ts self-ref ✅)
- `shippingProfile.userId` → `user.id` (listings.ts → auth.ts)
- `cart.userId` → `user.id` (commerce.ts → auth.ts)
- `cartItem.cartId` → `cart.id` (commerce.ts self-ref ✅)
- `cartItem.listingId` → `listing.id` (commerce.ts → listings.ts)
- `order.buyerId` → `user.id` (commerce.ts → auth.ts)
- `orderItem.orderId` → `order.id` (commerce.ts self-ref ✅)
- `orderItem.listingId` → `listing.id` (commerce.ts → listings.ts)
- `orderPayment.orderId` → `order.id` (commerce.ts self-ref ✅)
- `shipment.orderId` → `order.id` (shipping.ts → commerce.ts)
- `returnRequest.orderId` → `order.id` (shipping.ts → commerce.ts)
- `returnRequest.buyerId` → `user.id` (shipping.ts → auth.ts)
- `dispute.orderId` → `order.id` (shipping.ts → commerce.ts)
- `dispute.buyerId` → `user.id` (shipping.ts → auth.ts)
- `dispute.returnRequestId` → `returnRequest.id` (shipping.ts self-ref ✅)
- `review.orderId` → `order.id` (reviews.ts → commerce.ts)
- `review.reviewerUserId` → `user.id` (reviews.ts → auth.ts)
- `reviewResponse.reviewId` → `review.id` (reviews.ts self-ref ✅)
- `sellerPerformance.sellerProfileId` → `sellerProfile.id` (reviews.ts → identity.ts)
- `conversation.listingId` → `listing.id` (messaging.ts → listings.ts)
- `conversation.orderId` → `order.id` (messaging.ts → commerce.ts)
- `conversation.buyerId` → `user.id` (messaging.ts → auth.ts)
- `message.conversationId` → `conversation.id` (messaging.ts self-ref ✅)
- `message.senderUserId` → `user.id` (messaging.ts → auth.ts)
- `notification.userId` → `user.id` (notifications.ts → auth.ts)
- `notificationPreference.userId` → `user.id` (notifications.ts → auth.ts)
- `ledgerEntry.userId` → `user.id` (finance.ts → auth.ts)
- `ledgerEntry.orderId` → `order.id` (finance.ts → commerce.ts)
- `ledgerEntry.listingId` → `listing.id` (finance.ts → listings.ts)
- `payout.userId` → `user.id` (finance.ts → auth.ts)
- `payout.batchId` → `payoutBatch.id` (finance.ts self-ref ✅)
- `manualAdjustment.userId` → `user.id` (finance.ts → auth.ts)
- `manualAdjustment.ledgerEntryId` → `ledgerEntry.id` (finance.ts self-ref ✅)
- `crosslisterAccount.sellerId` → `user.id` (crosslister.ts → auth.ts)
- `channelProjection.listingId` → `listing.id` (crosslister.ts → listings.ts)
- `channelProjection.accountId` → `crosslisterAccount.id` (crosslister.ts self-ref ✅)
- `crossJob.sellerId` → `user.id` (crosslister.ts → auth.ts)
- `crossJob.projectionId` → `channelProjection.id` (crosslister.ts self-ref ✅)
- `crossJob.accountId` → `crosslisterAccount.id` (crosslister.ts self-ref ✅)
- `importBatch.sellerId` → `user.id` (crosslister.ts → auth.ts)
- `importBatch.accountId` → `crosslisterAccount.id` (crosslister.ts self-ref ✅)
- `importRecord.batchId` → `importBatch.id` (crosslister.ts self-ref ✅)
- `importRecord.listingId` → `listing.id` (crosslister.ts → listings.ts)
- `dedupeFingerprint.listingId` → `listing.id` (crosslister.ts → listings.ts)
- `channelCategoryMapping.twicelyCategoryId` → `category.id` (crosslister.ts → catalog.ts)
- `automationSetting.sellerId` → `user.id` (crosslister.ts → auth.ts)
- `helpdeskCase` — text FKs only (no `.references()` to marketplace tables per schema) — verify against schema
- `caseMessage.caseId` → `helpdeskCase.id` (helpdesk.ts self-ref ✅)
- `caseEvent.caseId` → `helpdeskCase.id` (helpdesk.ts self-ref ✅)
- `caseWatcher.caseId` → `helpdeskCase.id` (helpdesk.ts self-ref ✅)
- `caseCsat.caseId` → `helpdeskCase.id` (helpdesk.ts self-ref ✅)
- `helpdeskTeamMember.teamId` → `helpdeskTeam.id` (helpdesk.ts self-ref ✅)
- `kbArticle.categoryId` → `kbCategory.id` (kb.ts self-ref ✅)
- `kbArticleAttachment.articleId` → `kbArticle.id` (kb.ts self-ref ✅)
- `kbArticleRelation.articleId` → `kbArticle.id` (kb.ts self-ref ✅)
- `kbCaseArticleLink.caseId` → `helpdeskCase.id` (kb.ts → helpdesk.ts)
- `kbCaseArticleLink.articleId` → `kbArticle.id` (kb.ts self-ref ✅)
- `kbArticleFeedback.articleId` → `kbArticle.id` (kb.ts self-ref ✅)
- `platformSettingHistory.settingId` → `platformSetting.id` (platform.ts self-ref ✅)
- `staffUserCustomRole.staffUserId` → `staffUser.id` (platform.ts → staff.ts)
- `staffUserCustomRole.customRoleId` → `customRole.id` (platform.ts self-ref ✅)
- `providerInstance.adapterId` → `providerAdapter.id` (providers.ts self-ref ✅)
- `providerSecret.instanceId` → `providerInstance.id` (providers.ts self-ref ✅)
- `providerUsageMapping.primaryInstanceId` → `providerInstance.id` (providers.ts self-ref ✅)
- `providerUsageMapping.fallbackInstanceId` → `providerInstance.id` (providers.ts self-ref ✅)
- `providerHealthLog.instanceId` → `providerInstance.id` (providers.ts self-ref ✅)
- `promotionUsage.promotionId` → `promotion.id` (promotions.ts self-ref ✅)
- `promotionUsage.orderId` → `order.id` (promotions.ts → commerce.ts)
- `promotionUsage.buyerId` → `user.id` (promotions.ts → auth.ts)
- `promotedListing.listingId` → `listing.id` (promotions.ts → listings.ts)
- `follow.followerId` → `user.id` (social.ts → auth.ts)
- `follow.followedId` → `user.id` (social.ts → auth.ts)
- `watchlistItem.userId` → `user.id` (social.ts → auth.ts)
- `watchlistItem.listingId` → `listing.id` (social.ts → listings.ts)
- `savedSearch.userId` → `user.id` (social.ts → auth.ts)
- `taxInfo.userId` → `user.id` (tax.ts → auth.ts)
- `taxQuote.orderId` → `order.id` (tax.ts → commerce.ts)

**NO CIRCULAR IMPORTS EXIST** in this dependency graph. The import flow is one-directional:
```
enums → (no deps)
auth → enums
identity → enums, auth
staff → enums
catalog → enums
platform → enums, staff
providers → enums
subscriptions → enums, auth, identity
listings → enums, auth, catalog
commerce → enums, auth, listings
shipping → enums, auth, commerce
reviews → enums, auth, identity, commerce
messaging → enums, auth, listings, commerce
notifications → enums, auth
finance → enums, auth, commerce, listings
crosslister → enums, auth, listings, catalog
helpdesk → enums
kb → enums, helpdesk
promotions → enums, auth, commerce, listings
social → enums, auth, listings
tax → enums, auth, commerce
```

### Step 4: Create barrel `index.ts`

Replace `src/lib/db/schema/index.ts` with wildcard re-exports:

```typescript
export * from './enums';
export * from './auth';
export * from './identity';
export * from './staff';
export * from './catalog';
export * from './platform';
export * from './providers';
export * from './subscriptions';
export * from './listings';
export * from './commerce';
export * from './shipping';
export * from './reviews';
export * from './messaging';
export * from './notifications';
export * from './finance';
export * from './crosslister';
export * from './helpdesk';
export * from './kb';
export * from './promotions';
export * from './social';
export * from './tax';
```

### Step 5: Verify `drizzle.config.ts`

Ensure it points to the schema barrel:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

If it already looks like this, don't change it.

### Step 6: TypeScript compilation check

```bash
npx tsc --noEmit
```

**Must pass with ZERO errors.** If there are errors:
- Read the error message
- Fix the root cause (wrong import, wrong type, missing export)
- Do NOT add `as any`, `@ts-ignore`, or type assertion workarounds
- Show the error and the fix

### Step 7: Push schema to database

```bash
npx drizzle-kit push
```

This creates all 93 tables + 55 enums in the `twicely` PostgreSQL database.

**Must complete with zero errors.** Show the full output.

If push fails:
- Read the error (usually a missing enum reference, column type mismatch, or circular FK)
- Fix in the schema file
- Re-run push
- Show the fix and the successful output

### Step 8: Verify table count

```bash
psql $DATABASE_URL -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
```

**Expected: 93 tables.**

Also verify enum count:
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM pg_type WHERE typtype = 'e';"
```

**Expected: 55 enums.**

### Step 9: Spot-check 5 critical tables

Run these queries to verify column structure matches the schema:

```bash
psql $DATABASE_URL -c "\d user"
psql $DATABASE_URL -c "\d seller_profile"
psql $DATABASE_URL -c "\d listing"
psql $DATABASE_URL -c "\d \"order\""
psql $DATABASE_URL -c "\d ledger_entry"
```

Verify column names, types, and constraints match TWICELY_V3_SCHEMA.md exactly.

---

## AUDIT CHECKLIST — ALL MUST PASS BEFORE A2 IS DONE

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | TypeScript compiles | `npx tsc --noEmit` | Zero errors |
| 2 | Schema files count | `ls src/lib/db/schema/*.ts \| wc -l` | 22 files |
| 3 | Tables in DB | `psql` count query | 93 |
| 4 | Enums in DB | `psql` count query | 55 |
| 5 | No `as any` in schema | `grep -r "as any" src/lib/db/schema/` | No matches |
| 6 | No `@ts-ignore` in schema | `grep -r "@ts-ignore" src/lib/db/schema/` | No matches |
| 7 | No file over 300 lines | `wc -l src/lib/db/schema/*.ts` | All under 300 |
| 8 | Barrel exports complete | Import check from index.ts | All tables accessible |
| 9 | `order` table has `order_number` column | `psql` \d check | Present, text, unique, not null |
| 10 | `ledger_entry` has no `updatedAt` | `psql` \d check | NOT present (intentionally immutable) |

---

## WHAT NOT TO DO

❌ **Do not look for or create a `twicely-v3` subfolder.** The project root IS `C:\Users\XPS-15\Projects\Twicely`. All paths are relative to this root. "V3" only exists in planning document filenames, nowhere else.

❌ **Do not create Drizzle relations.** Relations (`relations()`) are a Drizzle feature for query building. They are separate from schema and will be added in a later step if needed.

❌ **Do not create migration files.** Use `drizzle-kit push` for development. Migration files (`drizzle-kit generate`) are for production CI/CD later.

❌ **Do not create seed data.** Seeding is Phase A5.

❌ **Do not create type exports** like `export type User = typeof user.$inferSelect`. Types are inferred from schema automatically. Add explicit type exports only when a slice needs them.

❌ **Do not add `"use server"` or `"use client"` directives** to schema files. They are pure data definitions.

❌ **Do not add comments explaining what columns do** unless the schema doc has them. The schema doc IS the documentation.

❌ **Do not rename the enum in `crosslisterAccount.status`.** The schema says `accountStatusEnum('account_status')` — the column name in DB is `account_status`, the enum type is `account_status`. Copy exactly.

❌ **Do not use `uuid()` anywhere.** All IDs are `text()` with CUID2 or Better Auth's own ID format.

❌ **Do not use `serial()` or `bigserial()`.** No auto-increment IDs.

❌ **Do not use `varchar()` for columns the schema defines as `text()`.** They are different Postgres types.

❌ **Do not add `onUpdate` or `onDelete` cascade rules** that aren't in the schema. If the schema says `.references(() => user.id, { onDelete: 'cascade' })`, add it. If it just says `.references(() => user.id)`, do NOT add cascade behavior.

---

## KNOWN GOTCHAS

1. **`order` is a reserved word in PostgreSQL.** Drizzle handles this with `pgTable('order', ...)` — it will auto-quote to `"order"`. Do not rename to `orders`.

2. **`user` is also reserved.** Same handling — Drizzle quotes it. Do not rename to `users`. Better Auth expects `user`.

3. **Some tables have `text('seller_id').notNull()` WITHOUT `.references()`.** This is intentional — it's a denormalized seller ID that could reference either `user.id` or `sellerProfile.id` depending on context. Do not add references that aren't in the schema.

4. **The `sellerBalance` table uses `userId` as its primary key**, not a CUID2 `id`. Copy this exactly: `userId: text('user_id').primaryKey().references(() => user.id)`.

5. **`listingImage` has no `updatedAt`.** This is intentional. Images are immutable — you delete and re-upload, never update in place.

6. **Several tables have `createdAt` only, no `updatedAt`.** These are append-only/immutable records: `listingFee`, `listingVersion`, `orderItem`, `caseMessage`, `caseEvent`, `caseCsat`, `helpdeskTeamMember`, `kbArticleAttachment`, `kbArticleRelation`, `kbCaseArticleLink`, `kbArticleFeedback`, `notification`, `ledgerEntry`, `feeSchedule`, `reconciliationReport`, `manualAdjustment`, `importRecord`, `promotionUsage`, `follow`, `watchlistItem`, `taxQuote`, `platformSettingHistory`, `providerHealthLog`, `auditEvent`. Do NOT add `updatedAt` to these.

7. **`uniqueIndex` vs `unique` vs `index`.** The schema uses all three. `uniqueIndex` creates a unique index. `unique().on(...)` creates a unique constraint. `index(...)` creates a non-unique index. Copy exactly which one the schema uses for each.

8. **Array defaults.** The schema uses `` sql`'{}'::text[]` `` for empty array defaults. Copy this SQL expression exactly, including the backtick template literal.

9. **`helpdeskCase` FK columns are plain `text()` without `.references()`.** The helpdesk case references orderId, listingId, sellerId, etc. as plain text columns — NOT foreign keys. This is intentional because helpdesk cases can reference entities across domains without hard coupling. Do not add `.references()`.

10. **Provider health log closing backtick.** In SCHEMA.md §14.12, there's a stray closing ``` at line 2231 after the providerHealthLog table. Ignore it — it's a markdown artifact, not code.

---

## AFTER A2 IS COMPLETE

Save a checkpoint:
```bash
tar -cf ../twicely-a2-schema.tar --exclude=node_modules --exclude=.next --exclude=.git .
```

Then proceed to **Phase A3: Auth + User Creation** (separate prompt).

---

**END OF A2 PROMPT**
