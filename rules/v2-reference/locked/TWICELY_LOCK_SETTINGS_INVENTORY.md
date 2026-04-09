# TWICELY_LOCK_SETTINGS_INVENTORY.md
## Authoritative Settings, Flags, and Gates Inventory

**Version:** 1.0
**Locked:** 2026-01-23
**Authority:** This document is the single source of truth for all platform-configurable settings.

---

## RBAC BOUNDARY RULE (AUTHORITATIVE)

- All settings defined in this document are **corp-admin settings**.
- Authorization for `/corp/settings/*` is governed **exclusively by PlatformRole**.
- Seller delegated scopes (defined in `TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md`)
  MUST NEVER authorize access to any setting in this document.
- The corp RBAC system and seller delegated RBAC system are intentionally separate
  and MUST NOT be merged.
- **Canonical PlatformRole values:** ADMIN, DEVELOPER, FINANCE, MODERATION, SUPPORT
- **Forbidden permission keys:** Do NOT use invented keys like `settings.write`, `settings.read`,
  `flags.kill`, `flags.write`, or `catalog.write`. Use PlatformRole only.

---

## PRECEDENCE RULE

**Settings Location Rule:** ALL platform-configurable settings MUST exist in the Unified Platform Settings page at `/corp/settings/platform`.

**Source:** TWICELY_V2_UNIFIED_PLATFORM_SETTINGS_CANONICAL.md:L9-16

---

## 1. KILL SWITCHES (Critical Circuit Breakers)

### 1.1 Kill Switch Definitions

| Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-----|-------------|---------|---------|--------------|----------|
| `kill.checkout` | Disable all checkout flows | `false` | FeatureFlag (isKillSwitch=true) | `PlatformRole.ADMIN` | /corp/settings/flags |
| `kill.payouts` | Disable payout execution | `false` | FeatureFlag (isKillSwitch=true) | `PlatformRole.ADMIN` | /corp/settings/flags |
| `kill.listing_activation` | Disable listing activation | `false` | FeatureFlag (isKillSwitch=true) | `PlatformRole.ADMIN` | /corp/settings/flags |
| `kill.search` | Disable search (show empty) | `false` | FeatureFlag (isKillSwitch=true) | `PlatformRole.ADMIN` | /corp/settings/flags |
| `kill.payments` | Disable payment processing | `false` | FeatureFlag (isKillSwitch=true) | `PlatformRole.ADMIN` | /corp/settings/flags |
| `kill.registration` | Disable user registration | `false` | FeatureFlag (isKillSwitch=true) | `PlatformRole.ADMIN` | /corp/settings/flags |

**Source:** TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md:L74-85

### 1.2 Kill Switch Behavior

- `scope = global`
- `isKillSwitch = true` on FeatureFlag model
- Cached for immediate evaluation
- Enforced at critical code paths
- Return 200 immediately when active (graceful degradation)

---

## 2. PAYOUT GATES

### 2.1 Gate Conditions

| Gate | Condition | Storage | Who Can Edit |
|------|-----------|---------|--------------|
| Seller Status | `SellerProfile.status = SELLER_ACTIVE` | SellerProfile | PlatformRole.ADMIN |
| Payouts Status | `SellerProfile.payoutsStatus = PAYOUTS_ENABLED` | SellerProfile | PlatformRole.ADMIN |
| Payout Destination | `PayoutDestination.isVerified = true` | PayoutDestination | System only |
| Kill Switch | `kill.payouts = false` | FeatureFlag | PlatformRole.ADMIN |
| Payout Hold | No active `PayoutHold` for seller | PayoutHold | PlatformRole.FINANCE |

**Source:** TWICELY_V2_INSTALL_PHASE_13:L1020-1038

### 2.2 Gate Service

```typescript
export async function canReceivePayouts(sellerId: string): Promise<{
  eligible: boolean;
  blockers: string[];
}>;
```

---

## 3. TRUST & QUALITY SETTINGS

### 3.1 Trust Band Thresholds

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `trust.base_score` | Starting trust score for new sellers | `80` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.volume_capped` | Orders threshold for neutral cap | `10` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.volume_limited` | Orders threshold for limited range | `50` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.band_excellent_min` | Minimum score for EXCELLENT band | `90` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.band_good_min` | Minimum score for GOOD band | `75` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.band_watch_min` | Minimum score for WATCH band | `60` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.band_limited_min` | Minimum score for LIMITED band | `40` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `trust.decay_half_life_days` | Days for event weight to halve | `90` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |

**Source:** TWICELY_RATINGS_TRUST_CANONICAL.md:L80-118

### 3.2 Trust Event Weights

| Setting Key | Description | Default | Storage |
|-------------|-------------|---------|---------|
| `trust.event.review_5_star` | Score delta for 5-star review | `+1.0` | PlatformSettings |
| `trust.event.review_4_star` | Score delta for 4-star review | `+0.5` | PlatformSettings |
| `trust.event.review_3_star` | Score delta for 3-star review | `-1.5` | PlatformSettings |
| `trust.event.review_2_star` | Score delta for 2-star review | `-4.0` | PlatformSettings |
| `trust.event.review_1_star` | Score delta for 1-star review | `-7.0` | PlatformSettings |
| `trust.event.late_shipment` | Score delta for late shipment | `-2.0` | PlatformSettings |
| `trust.event.seller_cancel` | Score delta for seller cancel | `-3.0` | PlatformSettings |
| `trust.event.refund_seller_fault` | Score delta for seller-fault refund | `-4.0` | PlatformSettings |
| `trust.event.dispute_opened` | Score delta for dispute opened | `-2.0` | PlatformSettings |
| `trust.event.dispute_seller_fault` | Score delta for seller-fault dispute | `-6.0` | PlatformSettings |
| `trust.event.chargeback` | Score delta for chargeback | `-8.0` | PlatformSettings |
| `trust.event.policy_violation` | Score delta for policy violation | `-12.0` | PlatformSettings |

**Source:** TWICELY_RATINGS_TRUST_CANONICAL.md:L137-156

---

## 4. SEARCH & DISCOVERY SETTINGS

### 4.1 Search Ranking Settings

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `search.title_weight` | Title match weight | `3.0` | SearchSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=discovery |
| `search.description_weight` | Description match weight | `1.0` | SearchSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=discovery |
| `search.trust_multiplier_enabled` | Enable trust-based ranking | `true` | SearchSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=discovery |
| `search.freshness_boost_enabled` | Enable recency boost | `true` | SearchSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=discovery |
| `search.default_page_size` | Default results per page | `48` | SearchSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=discovery |
| `search.max_page_size` | Maximum results per page | `100` | SearchSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=discovery |

**Source:** schema.prisma:L968-988

---

## 5. COMMERCE SETTINGS

### 5.1 Cart Settings

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `commerce.cart.expiry_hours` | Hours before cart expires | `72` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.cart.max_items` | Maximum items per cart | `100` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |

### 5.2 Order Settings

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `commerce.order.default_handling_days` | Default handling time in days | `3` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.order.auto_complete_days` | Days after delivery to auto-complete | `7` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.order.return_window_days` | Days allowed for returns | `30` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |

### 5.3 Offer Settings

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `commerce.offer.expiry_hours` | Hours before offer expires | `48` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.offer.max_counter_rounds` | Maximum counter-offer rounds | `3` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |

---

## 6. FULFILLMENT SETTINGS

### 6.1 Shipping Settings

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `fulfillment.shipping.combined_enabled` | Enable combined shipping | `true` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=fulfillment |
| `fulfillment.shipping.require_tracking` | Require tracking for fulfillment | `true` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=fulfillment |
| `fulfillment.shipping.domestic_only_default` | Default to domestic shipping only | `false` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=fulfillment |

### 6.2 Payout Settings

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `fulfillment.payout.frequency` | Default payout frequency | `weekly` | PlatformSettings | `PlatformRole.ADMIN | PlatformRole.FINANCE` | /corp/settings/platform?tab=fulfillment |
| `fulfillment.payout.min_amount_cents` | Minimum payout amount | `1000` | PlatformSettings | `PlatformRole.ADMIN | PlatformRole.FINANCE` | /corp/settings/platform?tab=fulfillment |
| `fulfillment.payout.hold_days_new_seller` | Hold period for new sellers | `7` | PlatformSettings | `PlatformRole.ADMIN | PlatformRole.FINANCE` | /corp/settings/platform?tab=fulfillment |

---

## 7. RECONCILIATION SETTINGS

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `reconciliation.frequency` | Reconciliation run frequency | `hourly` | PlatformSettings | `PlatformRole.ADMIN | PlatformRole.FINANCE` | /corp/settings/platform?tab=monetization |
| `reconciliation.daily_closeout` | Enable daily closeout run | `true` | PlatformSettings | `PlatformRole.ADMIN | PlatformRole.FINANCE` | /corp/settings/platform?tab=monetization |
| `reconciliation.mismatch_threshold_cents` | Threshold for mismatch alerts | `100` | PlatformSettings | `PlatformRole.ADMIN | PlatformRole.FINANCE` | /corp/settings/platform?tab=monetization |

**Source:** TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md:L289-290

---

## 8. PRIVACY & RETENTION SETTINGS

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `privacy.retention.webhook_events_days` | Days to retain webhook events | `180` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=privacy |
| `privacy.retention.audit_logs_days` | Days to retain audit logs | `365` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=privacy |
| `privacy.retention.analytics_days` | Days to retain analytics events | `730` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=privacy |
| `privacy.gdpr.data_export_enabled` | Enable GDPR data export | `true` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=privacy |
| `privacy.gdpr.deletion_request_enabled` | Enable GDPR deletion requests | `true` | PlatformSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=privacy |

---

## 9. BUNDLE SETTINGS

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `commerce.bundle.enabled` | Enable seller bundles | `true` | BundleSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.bundle.max_per_seller` | Max bundles per seller | `50` | BundleSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.bundle.max_discount_percent` | Max discount percentage | `50` | BundleSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.bundle.min_items` | Minimum items for bundle | `2` | BundleSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.bundle.smart_prompts_enabled` | Enable smart bundle prompts | `true` | BundleSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |
| `commerce.bundle.make_me_a_deal_enabled` | Enable buyer bundle requests | `true` | BundleSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=commerce |

**Source:** schema.prisma:L737-755

---

## 10. PROTECTION SETTINGS

| Setting Key | Description | Default | Storage | Who Can Edit | Admin UI |
|-------------|-------------|---------|---------|--------------|----------|
| `protection.default_coverage_cents` | Default buyer protection coverage | `10000000` ($100K) | ProtectionSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `protection.claim_window_days` | Days to file a claim | `30` | ProtectionSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `protection.appeal_window_days` | Days to file an appeal | `14` | ProtectionSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `protection.auto_approve_enabled` | Enable auto-approval for small claims | `true` | ProtectionSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |
| `protection.auto_approve_max_cents` | Max amount for auto-approval | `5000` | ProtectionSettings | `PlatformRole.ADMIN` | /corp/settings/platform?tab=trust |

**Source:** schema.prisma:L1992-2009

---

## 11. FEATURE FLAGS (Non-Kill-Switch)

| Key | Description | Default | Type | Storage |
|-----|-------------|---------|------|---------|
| `feature.new_checkout_flow` | New checkout experience | `false` | PERCENTAGE | FeatureFlag |
| `feature.enhanced_search` | Enhanced search algorithm | `false` | PERCENTAGE | FeatureFlag |
| `feature.seller_analytics_v2` | New seller analytics dashboard | `false` | TIER_BASED | FeatureFlag |
| `feature.ai_pricing` | AI-powered pricing suggestions | `false` | BOOLEAN | FeatureFlag |

**Admin UI:** /corp/settings/flags

---

## 12. ADMIN UI LOCATION MATRIX

| Settings Category | Admin UI Path | RBAC Permission |
|-------------------|---------------|-----------------|
| Kill Switches | /corp/settings/flags | `PlatformRole.ADMIN` |
| Feature Flags | /corp/settings/flags | `PlatformRole.ADMIN \| PlatformRole.DEVELOPER` |
| Monetization | /corp/settings/platform?tab=monetization | `PlatformRole.ADMIN \| PlatformRole.FINANCE` |
| Commerce | /corp/settings/platform?tab=commerce | `PlatformRole.ADMIN` |
| Fulfillment | /corp/settings/platform?tab=fulfillment | `PlatformRole.ADMIN` |
| Trust & Quality | /corp/settings/platform?tab=trust | `PlatformRole.ADMIN` |
| Discovery | /corp/settings/platform?tab=discovery | `PlatformRole.ADMIN` |
| Communications | /corp/settings/platform?tab=communications | `PlatformRole.ADMIN \| PlatformRole.SUPPORT` |
| Privacy | /corp/settings/platform?tab=privacy | `PlatformRole.ADMIN` |
| Notification Templates | /corp/settings/notifications/templates | `PlatformRole.ADMIN \| PlatformRole.SUPPORT` |
| Categories | /corp/settings/categories | `PlatformRole.ADMIN \| PlatformRole.MODERATION` |

---

## 13. STORAGE MODEL REFERENCE

### PlatformSettings Model

```prisma
model PlatformSettings {
  id          String   @id @default(cuid())
  category    String   // monetization | commerce | fulfillment | trust | discovery | communications | privacy
  key         String   // Specific settings key
  configJson  Json     // Configuration values
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  effectiveAt DateTime @default(now())
  
  @@unique([category, key, effectiveAt])
}
```

### FeatureFlag Model

```prisma
model FeatureFlag {
  id               String          @id @default(cuid())
  key              String          @unique
  name             String
  description      String?
  type             FeatureFlagType @default(BOOLEAN)
  enabled          Boolean         @default(false)
  scope            String          @default("global")
  percentage       Int?
  allowListUserIds String[]        @default([])
  denyListUserIds  String[]        @default([])
  allowListTiers   String[]        @default([])
  startsAt         DateTime?
  endsAt           DateTime?
  isKillSwitch     Boolean         @default(false)
  // ...
}
```

---

## SOURCE-OF-TRUTH REFERENCES

| Category | Source File | Lines |
|----------|-------------|-------|
| Unified Settings Architecture | TWICELY_V2_UNIFIED_PLATFORM_SETTINGS_CANONICAL.md | L1-100 |
| Kill Switches | TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md | L74-85 |
| Payout Gates | TWICELY_V2_INSTALL_PHASE_13.md | L1020-1038 |
| Trust Thresholds | TWICELY_RATINGS_TRUST_CANONICAL.md | L77-118 |
| Trust Event Weights | TWICELY_RATINGS_TRUST_CANONICAL.md | L137-156 |
| Search Settings | schema.prisma | L968-988 |
| Bundle Settings | schema.prisma | L737-755 |
| Protection Settings | schema.prisma | L1992-2009 |
| Reconciliation | TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md | L289-290 |

---

**END OF LOCK SHEET**
