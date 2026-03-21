# H4.2 Vestiaire Import - Findings

## Scope
- 6 new files, 3 modified files
- VestiaireConnector class (Tier C, SESSION, canUpdate:false)
- vestiaire-types.ts, vestiaire-schemas.ts, vestiaire-normalizer.ts, vestiaire-connector.ts
- normalizer-dispatch.ts VESTIAIRE case
- connectors/index.ts barrel import
- ~35 new tests

## Key Differences from TRR Pattern
- Session data field: `sessionToken` (not `sessionId`) — matches extension captureSession()
- Cookie header: `Cookie: _vc_session={sessionToken}` (not `session_id=`)
- Default currency: EUR (not USD) — Vestiaire is French company
- Fetch endpoint: `/items` (not `/consignments`)
- Response key: `items` (not `consignments`)
- Condition labels: "Never worn"/"Very good condition"/"Good condition"/"Fair condition"
- Status values: on_sale/sold/reserved/withdrawn/pending_moderation
- URL format: `vestiairecollective.com/products/p-{id}.html`
- Extra itemSpecifics: color, material (in addition to size)
- No CSRF token needed (unlike TRR)
- No authentication_status field (unlike TRR which authenticates luxury items)

## Pre-existing Infrastructure (from H4.1)
- VESTIAIRE in ExternalChannel type (types.ts)
- VESTIAIRE in CHANNEL_REGISTRY (channel-registry.ts)
- VESTIAIRE in channelEnum (DB migration)
- 7 platform settings seeded (seed-crosslister.ts)
- VESTIAIRE in getImportFlagKey(), platform-fees.ts, publish-service.ts maps

## Spec Gaps
1. No public API docs — API shape inferred from content script + TRR pattern
2. Default EUR currency — owner decision in prompt
3. authenticate() endpoint may not exist (CAPTCHA) — extension capture is primary
4. Price format in API vs HTML UI ambiguity
5. canShare: false confirmed from channel-registry

## Prompt Location
- `.claude/install-prompts/H4.2-vestiaire-import.md`
