# G10.8 Staff Impersonation — Findings

## Key Findings

### Schema
- NO `staffImpersonationSession` table in schema v2.1.3 (145 tables). NOT SPECIFIED.
- No impersonation token column in `staffSession` table.
- Impersonation session state must be tracked WITHOUT a new DB table.
- Decision: Use a short-lived signed cookie `twicely.impersonation_token` holding
  `{ targetUserId, staffUserId, expiresAt }` signed with HMAC-SHA256 (IMPERSONATION_SECRET env var).
  This avoids a new table while still being verifiable server-side.
  Write this as "NOT SPECIFIED — owner decision needed" in the prompt re: storage mechanism.

### CASL Permission
- `permission-registry-data.ts` already has `{ action: 'impersonate', label: 'Impersonate' }` for User subject.
- BUT `action-types.ts` only has `['read', 'create', 'update', 'delete', 'manage']`.
  `'impersonate'` is NOT a standard CASL action in our Action type. This is an inconsistency.
- Per Actors/Security Canonical §4.3.4: "impersonate" IS listed as a valid action for User subject.
- Resolution: Need to add 'impersonate' to ACTIONS array in action-types.ts.
- `platform-abilities.ts` does NOT yet grant `can('impersonate', 'User')` to SUPPORT or ADMIN — must add.
- Per canonical: Impersonate = read-only dashboard preview. SUPPORT and ADMIN have this.

### Routes
- Page Registry has NO dedicated impersonation route. The flow is:
  1. Button on `/usr/[id]` (hub) → POST to `/api/hub/impersonation/start`
  2. Redirect to `twicely.co` marketplace with impersonation token as cookie
  3. Impersonation banner renders across ALL marketplace pages while token is active
  4. "End impersonation" button → DELETE `/api/hub/impersonation/end`
- The banner must render in BOTH `(marketplace)/layout.tsx` AND `(hub)/my/layout.tsx`
  since a user's "my" dashboard is at /my/* (part of (hub) route group but NOT hub subdomain).

### Audit Event
- `auditEvent` table has: actorType, actorId, action, subject, subjectId, severity, detailsJson
- Action string: `'IMPERSONATE_USER'` (matches pattern used in admin-users.ts)
- Feature Lock-in §36 lists "Admin Actions | Settings changed, feature flag toggled, user impersonated"
- Must log START and END of impersonation sessions

### Existing user-actions.tsx
- Currently has: Suspend/Unsuspend + Warn buttons only
- Need to ADD: "View as user" button that calls the impersonation start action

### Layout Architecture
- `(marketplace)/layout.tsx` — public marketplace pages (SSR, reads auth session)
- `(hub)/my/layout.tsx` — authenticated user dashboard pages (SSR, reads auth session)
- Banner must go in BOTH layouts (since user can navigate between them during impersonation)
- Banner is a server component that reads the impersonation cookie

### SPEC INCONSISTENCIES
1. `action-types.ts` only allows 5 CASL actions, but Actors/Security §4.3.4 lists 'impersonate' as
   valid for User subject. Need to add 'impersonate' to ACTIONS + AppAbility type.
2. No DB table specified for impersonation session storage. "NOT SPECIFIED" in the prompt.
3. Actors/Security says "Impersonate = read-only dashboard preview" but doesn't specify:
   - Session duration (NOT SPECIFIED — owner decision needed)
   - Whether staff can take ANY actions during impersonation (spec says "read-only" but doesn't
     specify enforcement mechanism)
   - Whether all /my pages are accessible or just a subset

### Token Implementation Decision (for prompt)
- NOT SPECIFIED in any canonical. Two options to present:
  A) HMAC-signed JWT-like cookie (stateless, no DB table, short TTL e.g. 15 min)
  B) New DB table `staff_impersonation_session` (stateful, auditable, requires schema change)
- Given no table exists in schema: recommend option A (HMAC cookie) and flag as "NOT SPECIFIED"
