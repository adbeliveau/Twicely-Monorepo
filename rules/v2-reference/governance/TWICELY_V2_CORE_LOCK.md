# TWICELY V2 — CORE LOCK (Freeze Document)
**Status:** LOCKED (v1.2)  
**Effective:** Immediately  
**Purpose:** Freeze Twicely V2 architecture, invariants, and phase install plan so AI agents and devs cannot drift or reorder core flows.

---

## 1) What "LOCKED" means
When a file/phase is LOCKED:
- No refactors that rename routes/fields/tables without a new doc version.
- No behavior changes that contradict canonicals.
- Additive changes only, unless explicitly stated in a new locked revision.
- Any change request must be written as a new canonical or a new phase doc revision (v1.1, v1.2, etc.).

---

## 2) Twicely V2 scope (frozen)

### Included (V2)
- Phases 0-44 (core + growth + advanced marketplace features + listing variations)
- Backend-first implementation
- Provider-driven System Health + Doctor (CLI + UI)
- Deterministic state machines for commerce
- Ledger-first money and idempotent webhook processing
- RBAC + delegated access model
- Search eligibility + ranking pipeline with trust gating/cap-only protection
- Platform-managed promotions, subscriptions, analytics, messaging, disputes automation
- Full multi-currency support with exchange rates
- Complete internationalization with translations
- Variation listings (size/color/options)
- Seller standards and buyer protection programs
- SEO and public browse optimization
- Listing variations system with predefined types and values

### Excluded (NOT V2)
- Studio / page builder
- Crosslister
- AI modules (beyond translation)
- Real-time chat sockets
- Auctions
- Digital goods / Services

---

## 3) Immutable invariants (do not violate)

### Ownership
- All ownership resolves to `userId` only.

### Authorization
- Platform RBAC + delegated access only.
- Only Super Admin can create/grant Super Admin.

### State Machines
- No ad-hoc status mutations. All status changes via state machines.

### Money
- Paid status only via webhook/provider events.
- Ledger is immutable and authoritative internally.
- Reconciliation is read-only (never mutates ledger).
- Payout eligibility is ledger-derived and blocked by holds/verification.
- Currency conversions logged and traceable.

### Search/Trust
- Restricted sellers excluded (hard gate).
- New sellers protected by cap-only rules (no demotion due to low volume).

### Ops
- System Health provider-driven.
- Doctor must pass for "installed/healthy".

---

## 4) Phase ordering (frozen)

AI agents MUST install phases in order:

### Foundation (0-10)
0 Bootstrap  
1 Auth/RBAC  
2 Listings + Variations  
3 Orders/Shipping + Cart  
4 Payments/Webhooks/Ledger/Payouts  
5 Search/Discovery  
6 Trust/Policy/Ratings  
7 Notifications  
8 Analytics  
9 Feature Flags  
10 System Health + SRE + Modules + Doctor UI  

### Platform Operations (11-20)
11 Privacy/Retention  
12 Internationalization + Multi-Currency + Translations  
13 Seller Onboarding/Verification  
14 Returns/Disputes  
15 Corp Menus/Settings Registry  
16 Buyer Experience/Reviews + Watchlist + Saved Searches  
17 Search Ranking Pipeline  
18 Finance Recon/Reporting  
19 Audit/Observability  
20 Production Readiness Doctor Gate  

### Growth Features (21-28)
21 Messaging + System Notifications  
22 Promotions/Coupons  
23 Seller Analytics  
24 Subscriptions/Billing Tiers  
25 Promotions Automation  
26 Trust Insights  
27 Messaging Enhancements  
28 Disputes Automation  

### Advanced Marketplace (29-39)
29 Seller Hub + Vacation Mode + Block Lists  
30 Customer Support Console  
31 Taxes/Compliance  
32 Identity Verification/Risk  
33 Chargebacks/Claims  
34 Shipping Labels  
35 Catalog Normalization  
36 Promoted Listings (Ads)  
37 Seller Standards  
38 Buyer Protection  
39 SEO/Public Browse  

### Enhanced (40-44)
40 International Enhanced  
41 Variations Complete  
42 Seller Experience Plus  
43 Buyer Experience Plus  
44 Listing Variations  

---

## 5) Required `/rules/` contents (frozen contract)
- All canonicals you provided (source of truth)
- All phase install docs 0–44
- This lock file
- Master AI install prompt (next file)

---

## 6) Release discipline
- Any change requires:
  - a new doc revision (v1.1+) and
  - updates to Doctor checks and Health providers if behavior changes.

---

## 7) Changelog

### v1.2 (2026-01-22)
- Updated phase range from 0-39 to 0-44
- Added phases 40-44 (Enhanced features including Listing Variations)
- Fixed UTF-8 encoding issues

### v1.1 (2026-01-19)
- Updated phase range from 0-28 to 0-39
- Added phases 29-39 (Advanced Marketplace features)
- Added multi-currency and translation to scope
- Added variation listings to Phase 2 scope
- Added Cart to Phase 3 scope
- Added Watchlist/Saved Searches to Phase 16 scope
- Added Vacation Mode/Block Lists to Phase 29 scope
- Clarified currency conversion logging requirement
