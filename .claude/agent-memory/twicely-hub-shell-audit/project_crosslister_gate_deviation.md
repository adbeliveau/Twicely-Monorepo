---
name: Crosslister gate deviation in hub-nav.ts
description: hub-nav.ts intentionally uses IS_SELLER gate (not HAS_CROSSLISTER) for crosslister sub-group — product decision to allow free import for all sellers
type: project
---

The crosslister sub-group in `apps/web/src/lib/hub/hub-nav.ts` is gated with `IS_SELLER` instead of the canonical `HAS_CROSSLISTER` gate specified in `TWICELY_V3_UNIFIED_HUB_CANONICAL.md §3.2`.

**Why:** The file contains an inline comment: "Gate is IS_SELLER — free one-time import is available to ALL sellers regardless of ListerTier. The import flywheel must not be gated behind a subscription." This is a deliberate product decision to lower import friction.

**How to apply:** Flag this as canonical drift each audit cycle until the canonical is updated to reflect this decision. Do NOT suppress it — it needs owner acknowledgment and a canonical update or explicit FP entry in known-false-positives.md. It is not a security violation but it is undocumented spec deviation.
