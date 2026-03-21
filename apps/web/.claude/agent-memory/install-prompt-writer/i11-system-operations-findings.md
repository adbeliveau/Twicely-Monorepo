# I11 System & Operations - Findings

## Summary
- 6 hub admin pages: /health/[id], /flags/[id], /errors, /operations, /admin-messages, /search-admin
- 0 new database tables (all read from existing tables)
- 17 new files + 2-3 modified files
- ~60-80 new tests expected
- 4 new admin nav entries

## Key Existing Code
- Health: health/page.tsx, health/doctor/page.tsx, doctor-runner.ts, doctor-checks.ts, health-checks.ts
- Flags: flags/page.tsx, admin-feature-flags.ts (actions), feature-flags.ts (service), admin-feature-flags.ts (queries)
- Components: HealthStatusCard, HealthStatusBanner, DoctorCheckTable, FeatureFlagTable, KillSwitchPanel, LaunchGatePanel
- Schema: featureFlag (14.3), auditEvent (14.4, IMMUTABLE), providerInstance (14.9), providerHealthLog (14.12), providerAdapter (14.8)
- Doctor checks: 7 checks (db.connection, db.pool, app.env, app.settings, valkey.ping, typesense.health, centrifugo.health)

## CASL Subjects & Roles
- FeatureFlag: DEVELOPER (read, update), ADMIN (manage)
- AuditEvent: SUPPORT/MODERATION/FINANCE/DEVELOPER/SRE (read), ADMIN (read). NEVER delete.
- HealthCheck: DEVELOPER (read), SRE (read, manage), ADMIN (manage)
- Setting: ADMIN (manage)

## Spec Inconsistencies (4 found)
1. `/errors` listed in Feature Lock-in Section 23 as "Silent error log" but NO numbered entry in Page Registry
2. `/operations` NOT in Page Registry or Feature Lock-in, only in build tracker I11
3. `/admin-messages` NOT in Page Registry, no admin_broadcast table in schema; uses platformSetting with broadcast.* keys
4. `/search-admin` NOT in Page Registry, Typesense integration limited to doctor-check level

## Design Decisions
- Admin messages stored as platformSetting entries (broadcast.* prefix), not a dedicated table
- Error log page reads HIGH+CRITICAL audit events (read-only, immutable)
- Search admin calls Typesense REST API (/collections, /health) using platform setting URLs
- Operations page aggregates health + flags + critical events into one dashboard
- No seed entries for broadcast settings -- created at runtime through admin UI

## Audit Event Table Indexes
- ae_actor (actorType, actorId) -- for actor-based queries
- ae_subject (subject, subjectId) -- for flag detail audit history
- ae_action (action, createdAt) -- for action-type queries
- ae_severity (severity, createdAt) -- for error log page (HIGH/CRITICAL filter)

## Typesense API
- GET {url}/health -- health check
- GET {url}/collections -- list all indexes with metadata
- Headers: X-TYPESENSE-API-KEY: {apiKey}
- Config from: infrastructure.typesense.url, infrastructure.typesense.apiKey platform settings
