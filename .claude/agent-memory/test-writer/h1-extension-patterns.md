# H1.1 Browser Extension API — Testing Patterns

## Route overview (src/app/api/extension/)

| File | Method | Auth | Key behavior |
|---|---|---|---|
| authorize/route.ts | GET | Better Auth session | Generates 5-min reg token, redirects to /api/extension/callback?token= |
| callback/route.ts | GET | None | Serves HTML that postMessages token to extension opener |
| register/route.ts | POST | Registration JWT in body | Validates reg token, exchanges for 30-day session token |
| heartbeat/route.ts | POST | Session JWT in Auth header | Returns ACTIVE channel list + serverTime |
| session/route.ts | POST | Session JWT in Auth header | Upserts crosslisterAccount session data |
| detect/route.ts | POST | Session JWT in Auth header | Telemetry-only; logs detected platform |

## JWT Token Patterns

- Registration token: purpose=`extension-registration`, exp=5min, signed with EXTENSION_JWT_SECRET
- Session token: purpose=`extension-session`, exp=30d, signed with EXTENSION_JWT_SECRET
- All routes return 503 when EXTENSION_JWT_SECRET env var is missing/empty
- heartbeat and session routes: auth header checked BEFORE secret check — missing Bearer = 401 before 503

## Critical Implementation Notes

- `detect/route.ts` does NOT validate userId presence — only checks purpose. Token with valid purpose but no userId → 200 (intentional, telemetry endpoint).
- `heartbeat/route.ts` wraps BOTH jwt verify AND the DB query in the same try/catch. A DB error surfaces as 401 (not 500).
- `session/route.ts` has explicit inner try/catch around DB operations → DB throws = 500.
- `callback/route.ts`: `searchParams.get('token')` returns `""` for `?token=` (empty), falsy → 400.
- `register/route.ts` Zod schema is `.strict()` — extra fields return 400.
- `session/route.ts` channel enum = `['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL']` only (VESTIAIRE deferred to H4.1, EBAY not in extension).

## Test File Split Pattern for Extension Routes

Use `vi.resetModules()` in `beforeEach` + `await import('../route')` in each test (dynamic import pattern).
This ensures env var stubs (`vi.stubEnv`) apply to the freshly imported module each time.

## Coverage Reference

| Test file | Tests | What's covered |
|---|---|---|
| authorize.test.ts | 5 | unauthenticated, happy path, 5-min expiry, payload claims, 503 |
| authorize-ext.test.ts | 6 | session-throws→login, redirect param value, null userId, callback origin, empty-string userId, different userId in token |
| register.test.ts | 11 | missing token, invalid JSON, expired, wrong purpose, wrong secret, user-not-found, happy path, displayName fallbacks (null→name→Seller), 503 |
| register-ext.test.ts | 8 | absent userId, numeric userId, empty userId, avatarUrl priority, image fallback, 30-day token duration, strict schema, empty extensionVersion, expiresAt ms epoch |
| heartbeat.test.ts | 9 | missing header, no Bearer prefix, invalid token, wrong purpose, channels list, empty channels, serverTime, 200 success, expired token, 503 |
| heartbeat-ext.test.ts | 6 | absent userId→403, numeric userId→403, empty userId→403, DB throws→401, multiple channels, response shape |
| session.test.ts | 13 | missing header, invalid token, wrong purpose, invalid channel (EBAY), VESTIAIRE rejected, missing sessionData, insert path, update path, status ACTIVE, consecutiveErrors reset, FB_MARKETPLACE, 503 |
| session-ext.test.ts | 9 | malformed JSON→400, expired token→401, absent userId→403, DB insert throws→500, DB update throws→500, extra fields→400, THEREALREAL→200, insert field shape, update clears lastError |
| detect.test.ts | 4 | missing header, invalid token, wrong purpose, valid→200 |
| detect-ext.test.ts | 6 | 503 missing secret, expired→401, absent header variant, no-userId passes→200, 401 body shape, 403 body shape |
| callback.test.ts | 9 | missing token→400, valid→200 HTML, token in HTML, postMessage type, localStorage fallback, window.close, DOCTYPE, special chars JSON-encoded, empty string→400 |
