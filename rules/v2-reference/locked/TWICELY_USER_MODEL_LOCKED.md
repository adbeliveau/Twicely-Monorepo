# TWICELY EBAY-MIRRORED USER & BUSINESS MODEL (LOCKED)

## STATUS
**LOCKED BASELINE — DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines the **canonical user, seller, business, and staff model for Twicely**, intentionally mirroring **eBay's proven architecture**.

This file overrides all previous interpretations where conflicts exist.

---

## 1. SINGLE ACCOUNT RULE (NON-NEGOTIABLE)

Twicely has **ONE real account type**:

### `User`

There are:
- ❌ No buyer accounts
- ❌ No seller accounts
- ❌ No business accounts

Every person is a **User**.

All other concepts are **capabilities or metadata layered onto the same user**.

---

## 2. BUYER IS NOT A ROLE

Buying is **default behavior**.

- Users are NOT marked as buyers
- No buyer flags
- No buyer roles

If a user can authenticate, they can buy.

This mirrors eBay exactly.

---

## 3. SELLER IS A CAPABILITY, NOT AN ACCOUNT

A user becomes a seller **by action**, not registration.

### Activation rule
- First listing automatically enables selling

### Seller capability (on User model)
```ts
User {
  isSeller: boolean        // Has user ever listed?
  sellerType: "PERSONAL" | "BUSINESS"
  sellerActivatedAt: Date? // When first listing created
}
```

### Seller Type (Personal vs Business)

**PERSONAL** (default):
- Individual seller
- Can only use SELLER tier (casual seller)
- Cannot subscribe to a store (STARTER+)

**BUSINESS**:
- Registered business
- Can subscribe to any store tier (STARTER through ENTERPRISE)
- Has BusinessInfo record attached

### Store Gate Rule (eBay-Exact)
**Personal sellers CANNOT subscribe to a store.**
They must upgrade to BUSINESS first (free upgrade).

There is no "Become a Seller" flow. Selling starts on first listing.

---

## 4. OWNERSHIP RULE (CRITICAL)

**ALL ownership resolves to `userId`. Always.**

```ts
Listing.sellerId = userId
Order.sellerId   = userId
Order.buyerId    = userId
Payout.ownerId   = userId
```

### Forbidden
- businessId as owner
- storeId as owner
- staffId as owner

This rule is never broken.

---

## 5. BUSINESS IS METADATA (NOT AN ACCOUNT)

A business is **tax + legal information attached to a user**.

```ts
BusinessInfo {
  userId        // owner (one per user)
  legalName     // Legal business name
  businessType  // SOLE_PROPRIETOR | LLC | CORPORATION | PARTNERSHIP
  taxId         // EIN or SSN (encrypted)
  taxIdType     // SSN | EIN | ITIN
  address       // Business address
  verifiedAt    // When verified
}
```

### Business Upgrade Flow
1. Personal seller decides to open a store
2. System prompts: "Business account required"
3. User provides business info (FREE)
4. User.sellerType changes to BUSINESS
5. BusinessInfo record created
6. User can now subscribe to store (STARTER+)

Rules:
- Same user
- Same listings
- Same payouts
- Same ownership
- BusinessInfo is required for store subscription

**Business does NOT own anything.**

---

## 6. STORES ARE BRANDING + FEATURES ONLY

Stores are a **presentation and billing layer**.

```ts
Storefront {
  userId
  name
  branding
  subscriptionTier
}
```

Stores:
- Unlock features
- Change appearance
- Affect fees

Stores do NOT:
- Own listings
- Own orders
- Receive payouts

---

## 7. STAFF = DELEGATED ACCESS (NO OWNERSHIP)

Staff act **on behalf of** the owner.

```ts
DelegatedAccess {
  ownerUserId
  staffUserId
  permissions[]
}
```

Rules:
- Staff never own resources
- Staff never receive payouts
- All actions log:
```ts
actionByUserId
onBehalfOfUserId
```

This is legally and financially mandatory.

---

## 8. PERMISSION EVALUATION LOGIC

```text
IF user owns resource → ALLOW
ELSE IF acting as staff AND permission granted → ALLOW
ELSE → DENY
```

No inheritance.
No dual ownership.
No ambiguity.

---

## 9. BUYER → SELLER → BUSINESS → STORE LIFECYCLE

```text
1. User signs up
2. User buys items
3. User lists item → isSeller = true, sellerType = PERSONAL
4. User sells more → seller metrics tracked (SELLER tier, casual seller)
5. User wants store → prompted to upgrade to Business (FREE)
6. User provides business info → sellerType = BUSINESS, BusinessInfo created
7. User subscribes to store → tier = STARTER | BASIC | PRO | ELITE | ENTERPRISE
8. User adds staff → delegated access
```

### Valid Combinations (eBay-Exact)

| sellerType | storeTier | Valid? | Description |
|------------|-----------|--------|-------------|
| PERSONAL | SELLER | ✅ | Casual individual seller |
| PERSONAL | STARTER+ | ❌ | **NOT ALLOWED** |
| BUSINESS | SELLER | ✅ | Business selling without store |
| BUSINESS | STARTER+ | ✅ | Business with store subscription |

At no point:
- Is a new account created
- Is ownership transferred
- Is identity split

---

## 10. WHAT IS EXPLICITLY FORBIDDEN

❌ Separate buyer table  
❌ Separate seller table  
❌ Business-owned listings  
❌ Store-owned listings  
❌ Staff-owned payouts  
❌ Account switching  
❌ Dual ownership  

---

## 11. MINIMAL REQUIRED TABLES

```ts
User
UserCapabilities
BusinessInfo
Storefront
DelegatedAccess
Listing
Order
Payout
```

Anything beyond this must justify itself.

---

## 12. ENFORCEMENT RULE

Any code, migration, or feature that violates this document:
- Is considered a bug
- Must be reverted
- Requires an explicit version bump to change

---

## VERSION
- **v1.0 — eBay-mirrored baseline** (2026-01-17)
- **v1.1 — Personal/Business Alignment Patch** (2026-01-21)
  - Added SellerType (PERSONAL/BUSINESS) to Section 3
  - Updated BusinessInfo model with full schema in Section 5
  - Added Business Upgrade Flow documentation
  - Updated Lifecycle to include store gate in Section 9
  - Added Valid Combinations table (eBay-exact)
