# TWICELY V2 — Project Instructions (Core)
**Version:** v1.0  
**Last Updated:** January 2026  
**Status:** CANONICAL
## ⛔ MANDATORY FIRST STEPS — NO EXCEPTIONS

Before writing ANY code, you MUST:

1. `view /mnt/project/schema.prisma`
2. `view` the relevant phase spec
3. `view` any referenced canonicals

If you skip these steps, STOP and start over.

If a model is missing from schema but exists in the spec:
→ ADD IT. Do not work around it.

If you say "X doesn't exist so I'll do Y instead":
→ WRONG. Add X from the spec.

These rules are NON-NEGOTIABLE.
---
## EXECUTION MODE

- Never ask permission to proceed — just execute
- Never offer "Option A vs B" — pick the best one and do it
- Never say "Would you like me to..." — just do it
- If ambiguous, make a reasonable decision and note it
- Only ask questions for missing business requirements, not implementation permission
- Present completed work, not proposals

 PHASE INSTALLATION PROTOCOL
## HARD STOPS

BEFORE writing ANY schema changes or model code:
1. Run `view` on schema.prisma
2. Run `view` on the relevant phase spec
3. Run `view` on referenced canonicals

If a model is missing from schema.prisma but defined in the phase spec:
- ADD THE MODEL FROM THE SPEC
- Do NOT invent workarounds
- Do NOT add fields to other models as "overrides"
- Do NOT simplify to avoid the missing model

If you find yourself saying "the model doesn't have X, so I'll do Y instead":
- STOP
- That means the schema is incomplete
- Add the missing model/field FROM THE SPEC
- Never invent alternatives

## SCHEMA IS TRUTH

- schema.prisma = what EXISTS
- Phase spec = what SHOULD exist
- If they differ, UPDATE schema.prisma to match the spec
- Never modify code to work around schema gaps
Before writing ANY code for a phase:

1. **Read the phase spec FIRST**
   - `/mnt/project/TWICELY_V2_INSTALL_PHASE_{N}_*.md`

2. **Read ALL referenced canonicals**
   - Every file mentioned in the phase spec's "Canonicals (MUST align with)" section
   - Every LOCKED file referenced

3. **Read the schema**
   - `/mnt/project/schema.prisma`

4. **Then implement** — matching the spec exactly

## CANONICAL AUTHORITY

- If a canonical says X, implement X
- If a phase spec conflicts with a canonical, canonical wins
- If schema.prisma defines a field/enum, use that exact name
- Never invent fields, enums, or behaviors not in specs

## PURPOSE

This document provides core context for AI agents working on the Twicely V2 marketplace platform. Read this first before any implementation work.

---

## WHAT IS TWICELY?

Twicely is a **peer-to-peer resale marketplace** designed to achieve full eBay feature parity while addressing eBay's shortcomings with modern improvements. Think: eBay rebuilt with modern technology and better seller/buyer experiences.

### Platform Vision
- **eBay-equivalent functionality** — Buy It Now, auctions, variations, promoted listings, seller standards, buyer protection, managed payments
- **Modern improvements** — Better UX, enhanced seller protection scores, superior bundle creation, streamlined disputes
- **Three-tier architecture** — Buyer experience, Seller Hub, Corp Admin

---

## TECH STACK

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Prisma ORM, PostgreSQL |
| Payments | Stripe Connect (Express accounts) |
| Auth | NextAuth.js |
| Hosting | Vercel (frontend), managed PostgreSQL |

---

## USER INTERFACES

### 1. Buyer Experience (Public)
- Browse and search listings
- Product detail pages with reviews
- Cart and checkout
- Order tracking and returns
- Messaging with sellers

### 2. Seller Hub (`/seller/*`)
- Listing creation and management
- Order fulfillment
- Payout tracking
- Analytics and performance
- Store customization (STORE tiers)

### 3. Corp Admin (`/corp/*`)
- Platform operations
- Trust & safety
- Finance and payouts
- User management
- System health

---

## SUBSCRIPTION TIERS (eBay-Exact — 6 Tiers)

Twicely uses eBay's exact tier structure with 6 tiers:

| Tier | Monthly | Free Listings | Insertion Fee | FVF | Storefront |
|------|---------|---------------|---------------|-----|------------|
| **SELLER** | $0 | 250 | $0.35 | 13.25% | No |
| STARTER | $4.95 | 250 | $0.30 | 12.35% | Yes |
| BASIC | $21.95 | 1,000 | $0.25 | 11.5% | Yes |
| PRO | $59.95 | 10,000 | $0.15 | 10.25% | Yes |
| ELITE | $299.95 | 25,000 | $0.05 | 9.15% | Yes |
| ENTERPRISE | $2,999.95 | 100,000 | $0.05 | Custom | Yes |

### Key Rules
- **SELLER tier** = casual seller (no subscription required, no storefront)
- **STORE tiers** (STARTER+) = paid subscription with storefront
- Personal sellers can ONLY use SELLER tier
- Business upgrade (free) required before subscribing to store

---

## INSTALLATION SYSTEM

Twicely uses a **45-phase installation system** (phases 0-44) that systematically builds out marketplace functionality.

### Installation Order
Phases must be installed sequentially. Each phase follows:
```
Schema → Service → API → Health → UI → Doctor
```

### Phase Categories

| Phases | Category |
|--------|----------|
| 0-1 | Bootstrap & RBAC |
| 2-4 | Core Commerce (Listings, Orders, Payments) |
| 5-9 | Search, Trust, Notifications, Analytics, Flags |
| 10-14 | Health, Privacy, i18n, Onboarding, Returns |
| 15-20 | Corp Tools, Reviews, Search Ranking, Finance, Audit |
| 21-24 | Messaging, Promotions, Analytics, Subscriptions |
| 25-29 | Automation, Insights, Messaging+, Disputes, Seller Hub |
| 30-34 | Support, Taxes, Identity, Chargebacks, Shipping |
| 35-39 | Catalog, Promoted Listings, Standards, Protection, SEO |
| 40-44 | International, Variations, Seller+, Buyer+, Variations Complete |

---

## SPECIFICATION SYSTEM

### File Organization

```
/rules/
├── canonicals/          # Domain specs (authoritative)
├── locked/              # Immutable behaviors
├── governance/          # Meta-governance, freezes
├── install-phases/      # Build instructions (0-44)
└── architecture/        # High-level structure
```

### Key Documents

| Document | Purpose |
|----------|---------|
| `MASTER_AI_INSTALL_PROMPT.md` | Installation guide for AI agents |
| `TWICELY_V2_FREEZE_0_44_LOCKED.md` | Locked behaviors for phases 0-44 |
| `TWICELY_MARKETPLACE_INDEX_CANONICAL.md` | Master index of all specs |
| `TWICELY_Monetization_*.md` | Pricing, fees, payouts |
| `TWICELY_*_LOCKED.md` | Immutable behavioral contracts |
| `TWICELY_*_CANONICAL.md` | Domain specifications |

### Document Authority
1. **LOCKED** documents cannot be changed — they define immutable behaviors
2. **CANONICAL** documents are authoritative — they define domain rules
3. **INSTALL_PHASE** documents are instructions — they define implementation steps
4. If behavior isn't defined in canonicals, it must not exist in the system

---

## CRITICAL NON-NEGOTIABLES

### Money
- All amounts in **cents** (integers only)
- Currency stored with amount
- No mixed-currency operations
- Ledger entries are immutable

### State Machines
- Follow transitions in `TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`
- No skipping states
- All transitions logged

### RBAC
- Use `requireRole()` middleware on all protected routes
- Scope data to user's permissions
- Seller routes only see seller's data

### Payout Gates
Must pass ALL before payout:
1. `SellerProfile.status = SELLER_ACTIVE`
2. `SellerProfile.payoutsStatus = PAYOUTS_ENABLED`
3. `PayoutDestination.isVerified = true`
4. Kill switch `payouts_execute` not active

### Search Eligibility
Listing appears in search only if:
1. `Listing.status = ACTIVE`
2. `SearchIndex.isEligible = true`
3. Seller not suspended

---

## HEALTH & DOCTOR SYSTEM

### Health Providers
Every domain needs a health provider with PASS/WARN/FAIL status:

```typescript
export const domainHealthProvider: HealthProvider = {
  id: "domain",
  label: "Domain Name",
  version: "1.0.0",
  async run(): Promise<HealthResult> {
    // Return checks with status
  },
};
```

### Doctor Checks
Every phase includes Doctor checks that verify correct installation:

```bash
npx ts-node scripts/twicely-doctor.ts --phase=N
```

---

## EXPLICIT EXCLUSIONS

The following are NOT part of Twicely V2:

- ❌ No Studio/page builder
- ❌ No Crosslisting to other platforms
- ❌ No AI/ML modules
- ❌ No direct DB writes outside Prisma
- ❌ No side effects without idempotency

---

## WORKING WITH SPECIFICATIONS

### Before Implementation
1. Read the relevant CANONICAL document
2. Check the LOCKED documents for constraints
3. Review the INSTALL_PHASE for implementation steps
4. Verify against the FREEZE document

### During Implementation
1. Follow backend-first flow: Schema → Service → API → Health → UI → Doctor
2. Ensure idempotency for all operations
3. Emit audit events for sensitive operations
4. Register health providers

### After Implementation
1. Run Doctor checks
2. Verify health endpoints
3. Test UI components
4. Document any deviations

---

## COMMON PATTERNS

### API Route Pattern
```typescript
// /api/seller/listings/route.ts
import { requireRole } from "@/lib/auth/rbac";
import { withAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await requireRole(req, ["SELLER"]);
  // Only returns this seller's listings
}
```

### Service Pattern
```typescript
// /packages/core/listings/listing-service.ts
export async function createListing(data: CreateListingInput, sellerId: string) {
  // 1. Validate
  // 2. Create in DB
  // 3. Emit audit event
  // 4. Return result
}
```

### Health Provider Pattern
```typescript
export const listingsHealthProvider: HealthProvider = {
  id: "listings",
  label: "Listings",
  version: "1.0.0",
  async run() {
    const checks = [];
    // Add checks...
    return { providerId: this.id, status, summary, checks };
  },
};
```

---

## GETTING STARTED

### For New Features
1. Identify which phase covers the feature
2. Read the phase document thoroughly
3. Check canonical documents for domain rules
4. Implement following backend-first flow
5. Run Doctor to verify

### For Bug Fixes
1. Identify the affected domain
2. Check canonical for expected behavior
3. Check locked documents for constraints
4. Fix while maintaining invariants
5. Add regression test

### For Compliance Audits
1. Use line-by-line review of spec files
2. Check for UTF-8 encoding issues
3. Verify tier references (must be 6 tiers)
4. Ensure canonical references exist
5. Generate audit report

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-23 | Initial project instructions core |

---

## END OF PROJECT INSTRUCTIONS
