---
name: Emergency delist uses separate BullMQ queue, not crossJob table
description: EMERGENCY_DELIST jobs bypass the crossJob DB table entirely — they go straight into a separate BullMQ queue
type: feedback
---

The canonical spec §5.3 lists `EMERGENCY_DELIST` as a `jobTypeEnum` value for `crossJob`. In the implementation, emergency delist jobs are NOT tracked in the `crossJob` table — they go directly into the `lister:emergency-delist` BullMQ queue via `emergencyDelistQueue.add()`.

**Why:** Emergency delists must be zero-latency. Adding a DB row before dispatching to BullMQ would add latency. The architectural decision (documented in `packages/crosslister/src/services/projection-cascade.ts` comments) separates the EMERGENCY_DELIST queue from the regular crossJob pipeline specifically because "EMERGENCY_DELIST jobs run in a separate BullMQ queue (lister:emergency-delist) and are never in crossJob — they are unaffected by cancellation calls."

**How to apply:** The `publishJobTypeEnum` not containing `EMERGENCY_DELIST` is correct and intentional. Similarly, `AUTO_RELIST`/`AUTO_OFFER`/`AUTO_SHARE`/`AUTO_PRICE_DROP` use `automationQueue`, not `crossJob`. Do not flag these as spec violations.
