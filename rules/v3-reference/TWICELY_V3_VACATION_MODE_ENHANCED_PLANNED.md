# TWICELY V3 — Vacation Mode Enhanced (Planned — Post-Launch Wave 1)

**Version:** v1.0 | **Date:** 2026-04-08 | **Status:** PLANNED (post-launch Wave 1, first 30–90 days)
**Source:** Ported from Twicely V2
- `TWICELY_V2_INSTALL_PHASE_42_SELLER_EXPERIENCE_PLUS.md` (schema + services)
- `TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md` § 5 (business rules)

---

## 1. CORRECTION FROM INITIAL GAP ANALYSIS

My first V2-vs-Mono gap report described V2 as having "three distinct vacation modes (Away/Paused/Hidden)." That framing was imprecise.

**V2 actually has ONE vacation mode with configurable flags.** The perceived "modes" are behavioral variants that emerge from flag combinations:

| Flag | Effect |
|---|---|
| `hideListings=true` | Remove listings from search entirely ("Hidden"-like behavior) |
| `hideListings=false` + `extendHandling=true` | Listings visible with delayed-handling banner ("Paused"-like behavior) |
| `hideListings=false` + `extendHandling=false` | Listings visible, orders flow normally, auto-reply only ("Away"-like behavior) |

So the real improvement over a single toggle is **granular flags + scheduling + auto-reply**, not literally three modes. This doc ports that accurately.

---

## 2. WHY POST-LAUNCH (not pre-launch)

Small scope (~3–5 days) but still additive scope against a frozen launch. Ship in Wave 1 once core flows are stable. Real sellers will request this within the first month of launch — build it then.

---

## 3. CORE MODEL

```typescript
// Drizzle schema

export const vacationModeSchedule = pgTable("vacation_mode_schedule", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull().unique(),
  isActive: boolean("is_active").default(false),
  activatedAt: timestamp("activated_at"),

  // Auto-reply
  autoReplyMessage: text("auto_reply_message"),  // max 500 chars

  // Listing behavior flags
  hideListings: boolean("hide_listings").default(true),
  extendHandling: boolean("extend_handling").default(true),
  handlingDaysAdd: integer("handling_days_add").default(7),
  pausePromotions: boolean("pause_promotions").default(true),

  // Schedule
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),

  // Reminders
  reminderSentAt: timestamp("reminder_sent_at"),
  reminderDays: integer("reminder_days").default(2),  // days before end

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Note:** add `isHiddenByVacation: boolean` to the `listings` table so search queries can efficiently exclude. V2 uses this pattern.

---

## 4. BEHAVIORAL VARIANTS (via flag combinations)

| Scenario | `hideListings` | `extendHandling` | `pausePromotions` | Result |
|---|---|---|---|---|
| **Hard away** (real vacation) | true | — | true | Listings gone from search; no orders possible |
| **Soft away** (warehouse move) | false | true | true | Listings visible with "Ships in +7 days" banner; orders still allowed |
| **Away-but-open** (short trip) | false | false | false | Listings unchanged; buyer sees auto-reply on messages only |

These are not separate database modes — just presets the UI should offer for common cases. A seller can still build any custom combination.

---

## 5. BUSINESS RULES (from V2 canonical)

### Auto-reply
- Sent **once per conversation** during vacation (no spam loops)
- Seller can customize the message
- **Must NOT contain off-platform contact info** — enforced by regex + moderation
- Max 500 characters
- Default template provided if seller doesn't customize

```
Thanks for your message! I'm currently away and will respond when I return.
Feel free to browse my other listings in the meantime.
```

### Scheduled activation
- Cron runs hourly
- Sellers can set `scheduledStart` in future → activates automatically
- Sellers can set `scheduledEnd` → deactivates automatically
- `reminderSentAt` gate prevents duplicate reminders

### Deactivation
- Unhide all listings (`isHiddenByVacation=false`)
- Resume paused promotions
- Clear `activatedAt`
- Do NOT clear settings — seller may want same config for next vacation

### Listings during vacation
- If `hideListings=true`, set `isHiddenByVacation=true` on all ACTIVE listings
- Search index must respect this flag (exclude from results)
- Seller dashboard still shows all listings with "Hidden (vacation)" indicator

### Promotions during vacation
- If `pausePromotions=true`, pause all seller's promoted listings
- Promoted credit is NOT consumed while paused
- Resume from exact state on deactivation

### Offers/messages during vacation
- If `hideListings=true`: offers blocked; messages still receivable but auto-replied
- If `hideListings=false`: offers allowed; messages auto-replied

---

## 6. RBAC

| Action | Permission |
|---|---|
| View vacation settings | `settings.vacation.view` |
| Manage vacation settings | `settings.vacation.manage` |

(Use Mono's CASL rules, not V2's scope strings.)

---

## 7. INTEGRATION POINTS

| System | Integration |
|---|---|
| Search service | Exclude listings where `isHiddenByVacation=true` |
| Listing service | Apply `isHiddenByVacation` flag on activation, clear on deactivation |
| Message service | Check vacation status on incoming message; send auto-reply if not already sent in this conversation |
| Offer service | Block new offers if `hideListings=true` |
| Promotions service | Pause/resume promoted listings |
| Notification service | Send vacation-ending reminder |
| BullMQ | Hourly cron for `processVacationSchedules()` |

---

## 8. HEALTH CHECKS

- No active vacation with `scheduledEnd < now` (should auto-deactivate)
- No vacation with `scheduledEnd < scheduledStart` (invalid schedule)
- No seller with > 1 vacation row (unique on sellerId)

---

## 9. MONO-SPECIFIC ADAPTATION

| Concern | V2 Pattern | Mono Adaptation |
|---|---|---|
| Schema | Prisma | Drizzle (Section 3) |
| Cron | Custom scheduler | BullMQ repeatable job |
| Auto-reply delivery | Custom mailer | React Email + Resend (Mono's existing stack) |
| Search exclusion | Phase 17 index | Typesense filter on `isHiddenByVacation:false` at query time |
| Off-platform contact enforcement | Regex | Reuse Mono's existing message moderation service if present |
| Realtime seller banner | N/A | Centrifugo push to seller's dashboard when auto-activated |

---

## 10. UI PRESETS (seller-friendly defaults)

The Seller Hub Settings → Vacation page should offer these one-click presets before exposing raw flags:

1. **"I'm on vacation"** — `hideListings=true, pausePromotions=true`
2. **"Slower shipping for a bit"** — `hideListings=false, extendHandling=true, handlingDaysAdd=7, pausePromotions=false`
3. **"Monitoring messages only"** — `hideListings=false, extendHandling=false, pausePromotions=false`
4. **"Custom"** — raw flag controls

---

## 11. COMPLETION CRITERIA

- [ ] `vacationModeSchedule` table migrated
- [ ] `isHiddenByVacation` column added to `listings`
- [ ] Vacation service: activate, deactivate, get settings
- [ ] BullMQ cron: scheduled activation, deactivation, reminders
- [ ] Auto-reply one-per-conversation logic
- [ ] Off-platform contact regex filter on auto-reply
- [ ] Search index respects `isHiddenByVacation`
- [ ] Promotions pause/resume wired
- [ ] Seller Hub vacation page with presets + custom
- [ ] Health provider checks
- [ ] Audit events: `seller.vacation.activated`, `seller.vacation.deactivated`, `seller.vacation.settings_updated`

---

## 12. REFERENCE

- V2 Prisma + services: `Twicely-V2/rules/install-phases/TWICELY_V2_INSTALL_PHASE_42_SELLER_EXPERIENCE_PLUS.md`
- V2 business rules: `Twicely-V2/rules/canonicals/New folder/TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md` § 5

Scanned and imported 2026-04-08 as part of V2 → Mono gap analysis.
