# Codemaps Index

**Last Updated:** 2026-04-06

Comprehensive architectural maps of major Twicely systems and features. Start here to navigate codebase documentation.

---

## Quick Navigation

### Major Features & Systems

| Codemap | Purpose | Entry Points | Scale |
|---------|---------|--------------|-------|
| [Seller Activation](./CODEMAPS_SELLER_ACTIVATION.md) | One-click seller profile activation + onboarding | `/api/seller/activate`, `/my/selling` | 5 files, 100 LOC |
| [Feature Registry App](./CODEMAPS_REGISTRY_APP.md) | Feature discovery, dependency mapping, MCP integration | `/apps/registry`, `/scripts/mcp-server.ts` | 20+ files, 5000+ LOC |

### Recent Changes

- [RECENT_CHANGES.md](./RECENT_CHANGES.md) — All changes made in this session (seller activation, registry app, fixes)

---

## Seller Activation Codemap

**What:** One-click seller activation flow

**Key Files:**
- `/apps/web/src/app/api/seller/activate/route.ts` — API endpoint
- `/apps/web/src/lib/listings/seller-activate.ts` — Business logic
- `/apps/web/src/lib/queries/seller-dashboard.ts` — Stats queries
- `/apps/web/src/components/hub/hub-sidebar.tsx` — UI trigger

**Architecture:**
```
User clicks "Start Selling"
  ↓
GET /api/seller/activate
  ↓
ensureSellerProfile(userId)
  ↓
Redirect to /my/selling
  ↓
Dashboard + CTAs (for 0 listings)
```

**Key Functions:**
- `ensureSellerProfile()` — Creates/activates seller profile with status=ACTIVE
- `getSellerStats()` — Fetches dashboard metrics (using Drizzle lt() operator)
- `GET /api/seller/activate` — One-click activation route

**Database:**
- `seller_profile` table (userId, status, sellerType, etc.)

**Authorization:** Authenticated users only (session required)

[Read Full Codemap →](./CODEMAPS_SELLER_ACTIVATION.md)

---

## Feature Registry App Codemap

**What:** Codespring-like feature discovery and management dashboard

**Key Components:**
- **Views:** Dashboard, Feature Board (Kanban), Canvas (React Flow mind-map), Code Map, Search, Tasks
- **Manifest System:** `feature-manifest.json` (221 features, 190 routes, 310 tables)
- **MCP Server:** 7 tools for Claude Code integration
- **Scaffolder:** Auto-parse codebase to update manifest

**Architecture:**
```
Feature Registry App (Vite + React)
  ├── Views (6 different interfaces)
  ├── Feature Manifest (221 features, auto-generated)
  ├── MCP Server (Claude Code integration)
  └── Scaffolder (auto-sync codebase)
```

**Key Files:**
- `/apps/registry/` — Main Vite + React app
- `/scripts/mcp-server.ts` — MCP server with 7 tools
- `/scripts/scaffold-manifest.ts` — Manifest generator
- `/feature-manifest.json` — Feature database

**Statistics:**
- Features tracked: 221
- Routes: 190
- Database tables: 310
- Source files parsed: 2,639

**MCP Tools:**
1. `list_features` — List/filter features
2. `get_feature_detail` — Full feature details
3. `search_codebase` — Full-text search
4. `parse_feature_manifest` — Re-parse from code
5. `generate_prds` — Generate PRDs
6. `map_feature_to_code` — Show all artifacts
7. `sync_manifest` — Update manifest

[Read Full Codemap →](./CODEMAPS_REGISTRY_APP.md)

---

## Code Changes Summary

### New Features

| Feature | Files | Status | Details |
|---------|-------|--------|---------|
| Feature Registry App | 20+ | ✅ | Vite + React SPA with MCP server |
| Seller Activation Route | 1 | ✅ | GET /api/seller/activate endpoint |
| Feature Manifest | 1 | ✅ | 221 features, auto-generated |

### Fixes

| Issue | File | Status | Details |
|-------|------|--------|---------|
| Seller profile incomplete | seller-activate.ts | ✅ | Now sets status=ACTIVE + sellerType=PERSONAL |
| Dashboard stats SQL error | seller-dashboard.ts | ✅ | Replaced raw sql with Drizzle lt() operator |
| Hydration mismatch | notification-bell.tsx | ✅ | Added suppressHydrationWarning |

### Updates

| Component | Change | Status |
|-----------|--------|--------|
| Hub sidebar | "Start Selling" → /api/seller/activate | ✅ |
| Seller dashboard | Add CTAs for 0 listings | ✅ |

---

## How to Use These Codemaps

### For Understanding System Architecture

1. Pick a system from the table above
2. Open the corresponding codemap
3. Review the Architecture section (data flow diagram)
4. Read Key Modules table for entry points
5. Reference related code files as needed

### For Contributing to a Feature

1. Find the feature's codemap
2. Review Database Schema section
3. Check Authorization Model (CASL rules)
4. Look at Error Handling patterns
5. Run tests from Testing Coverage section

### For Debugging

1. Find the relevant codemap
2. Trace the Data Flow section
3. Check Error Handling for your error type
4. Review Troubleshooting section
5. Look at Related Tests

### For API Integration

1. Find the codemap for your endpoint
2. Check Route Integration section
3. Review request/response formats in Data Flow
4. Check Authorization rules
5. Look at Error responses

---

## File Organization

```
docs/
├── CODEMAPS_INDEX.md              (This file)
├── RECENT_CHANGES.md              (All changes this session)
├── CODEMAPS_SELLER_ACTIVATION.md  (Seller activation feature)
└── CODEMAPS_REGISTRY_APP.md       (Feature registry dashboard)
```

---

## What's Documented Here

### Seller Activation Codemap Includes

- Architecture diagram
- Key modules table (file paths, purposes, dependencies)
- Data flow (profile creation, stats queries, API routes)
- Database schema (seller_profile, users, listings tables)
- Route integration (/api/seller/activate, /my/selling)
- CASL authorization rules
- Error handling matrix
- Testing coverage
- Troubleshooting guide
- Performance notes

### Feature Registry Codemap Includes

- Overall architecture
- 6 view components (Dashboard, Board, Canvas, CodeMap, Search, Tasks)
- Feature manifest schema (221 features structure)
- MCP server tools (7 available functions)
- Manifest scaffolder (auto-parse algorithm)
- File locations
- Build & deployment
- Data integration (GitHub, Sentry, Analytics)
- Performance metrics
- Claude Code integration
- Troubleshooting

---

## Key Statistics

### Seller Activation
- **Lines of Code:** ~100
- **Files Modified:** 5
- **Database Tables:** 1 (seller_profile)
- **Routes Added:** 1 (/api/seller/activate)
- **Components Modified:** 2

### Feature Registry App
- **Lines of Code:** 5000+
- **Files Created:** 20+
- **Features Tracked:** 221
- **Routes Mapped:** 190
- **Database Tables Parsed:** 310
- **Source Files Analyzed:** 2,639

---

## Technology Stack

### Seller Activation
- Next.js 15 (API routes)
- Better Auth (authentication)
- Drizzle ORM (database)
- PostgreSQL (database)
- TypeScript strict mode

### Feature Registry App
- Vite (build tool)
- React 19 (UI framework)
- React Flow (mind-map visualization)
- TypeScript
- Node.js (MCP server)

---

## Testing & Quality

### Tests Baseline
- **Tests:** 9232+ passing
- **TypeScript errors:** 0
- **Test files:** 731+
- **Coverage:** 80%+

### Validation
- ✅ TypeScript strict mode passes
- ✅ All banned terms removed
- ✅ All files <300 lines
- ✅ Authorization checks in place
- ✅ Database migrations applied

---

## Related Documentation

### Canonical Specifications

| Document | Location | Relevance |
|----------|----------|-----------|
| Page Registry | `read-me/TWICELY_V3_PAGE_REGISTRY.md` | Route definitions |
| Database Schema | `read-me/TWICELY_V3_SCHEMA_v2_0_7.md` | Table structures |
| Unified Hub | `read-me/TWICELY_V3_UNIFIED_HUB_CANONICAL.md` | Hub layout, seller onboarding |
| Security & CASL | `read-me/TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Authorization rules |
| Feature Lock-in | `read-me/TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Feature specifications |

### Build System

| Document | Location |
|----------|----------|
| Build Tracker | `read-me/TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` |
| Build Rules | `CLAUDE.md` (root) |
| Web App Rules | `apps/web/CLAUDE.md` |

---

## Changelog

### 2026-04-06
- Created Feature Registry App (Vite + React SPA)
- Added MCP server with 7 Claude Code tools
- Created Feature Manifest system (221 features)
- Added Seller Activation API route
- Fixed seller profile creation (status=ACTIVE, sellerType=PERSONAL)
- Fixed seller dashboard stats query (Drizzle lt() operator)
- Fixed hydration mismatch (notification-bell suppressHydrationWarning)
- Updated hub sidebar navigation
- Added seller dashboard CTAs for new sellers

---

## How to Keep Codemaps Current

### After Code Changes

1. **If you modify a file in a codemap:** Update the relevant codemap section
2. **If you add a new feature:** Create new codemap file following the template
3. **If you change a route:** Update Route Integration section
4. **If you modify database:** Update Database Schema section

### Automation

For Feature Registry:
```bash
# Auto-update manifest when code changes
npx tsx scripts/scaffold-manifest.ts
```

### Sync Schedule

- **Manual:** After every feature completion
- **Automated (CI/CD):** Nightly sync of feature-manifest.json
- **Review:** Monthly codemap quality check

---

## Contributing to Codemaps

### Codemap Template

All codemaps should include:
1. Entry points (key files)
2. Architecture diagram
3. Key modules table
4. Data flow section
5. Database schema
6. Route integration
7. Authorization (CASL)
8. Error handling
9. Testing coverage
10. Troubleshooting
11. Related docs

### Creating New Codemaps

```bash
# Copy template
cp docs/CODEMAPS_TEMPLATE.md docs/CODEMAPS_YOUR_FEATURE.md

# Edit with your content
# Add to CODEMAPS_INDEX.md

# Commit
git add docs/CODEMAPS_*
git commit -m "docs: add codemap for [feature]"
```

---

## Need Help?

### For Implementation Questions
→ Check the relevant codemap's "Data Flow" and "Testing Coverage" sections

### For Debugging
→ Check "Troubleshooting" and "Error Handling" sections

### For API Integration
→ Check "Route Integration" and "Authorization" sections

### For Database Queries
→ Check "Database Schema" section

### For Understanding Architecture
→ Check "Architecture" diagram and "Key Modules" table

---

**Last synced:** 2026-04-06
**Manifest version:** 1.0.0
**Next review:** 2026-05-06

