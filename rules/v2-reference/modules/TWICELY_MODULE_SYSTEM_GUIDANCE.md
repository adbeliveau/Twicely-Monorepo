# TWICELY MODULE SYSTEM GUIDANCE
**Status:** INFORMATIONAL (v1.0)  
**Scope:** AI agent guidance for future module development  
**Audience:** AI agents, future module developers

---

## 1. Purpose

This document clarifies the purpose and status of the `/modules/` specification files.

**The module system specifications are:**
- âœ… AI guidance for future module development
- âœ… Reference architecture for extensibility
- âœ… Template for third-party integrations
- âŒ NOT required for MVP launch
- âŒ NOT blocking Phase 0

---

## 2. Module System Overview

### 2.1 What Are Modules?

Modules are **optional extensions** to the Twicely platform that:
- Add new functionality without modifying core code
- Follow standardized interfaces for installation/health
- Can be developed by Twicely or third parties
- Are validated by the module linter before installation

### 2.2 Example Future Modules

| Module | Purpose | Priority |
|--------|---------|----------|
| AI Pricing Suggestions | ML-based price recommendations | Post-launch |
| Multi-Warehouse | Inventory across locations | Enterprise |
| Dropshipping | Supplier integration | Post-launch |
| Social Commerce | Instagram/TikTok sync | Post-launch |
| Auction Engine | Real-time bidding | Phase 45+ |
| Affiliate Program | Referral tracking | Post-launch |

---

## 3. Current Specification Files

Located in `/modules/` (or `/mnt/project/` root):

| File | Purpose |
|------|---------|
| `Twicely-Module-Creation-Template-v1.md` | Template for new modules |
| `Twicely-Module-Linter-Spec-v1.md` | Validation rules for modules |
| `Twicely-Module-Installer-UI-Canonical-v1.md` | UI for module management |
| `Twicely-Module-Runtime-Guards-Canonical-v1.md` | Runtime safety checks |
| `Twicely-AI-Module-Validation-Checklist-v1.md` | AI agent validation steps |
| `twicely-modules-integration-checklist.md` | Integration requirements |
| `Twicely-Studio-SelfInstall-and-Health-Master-Prompt.md` | Master prompt for AI |

---

## 4. AI Agent Instructions

### 4.1 When Building Modules (Future)

When tasked with creating a Twicely module, AI agents should:

1. **Read the Module Creation Template** first
2. **Follow the validation checklist** during development
3. **Run the linter spec** checks before completion
4. **Implement health provider** per the health spec
5. **Document all external dependencies**

### 4.2 Module Structure

```
/modules/my-module/
â”œâ”€â”€ manifest.json           # Module metadata
â”œâ”€â”€ README.md               # Documentation
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ index.ts            # Entry point
â”‚   â”œâ”€â”€ health.ts           # Health provider
â”‚   â”œâ”€â”€ routes/             # API routes (if any)
â”‚   â”œâ”€â”€ services/           # Business logic
â”‚   â””â”€â”€ components/         # UI components (if any)
â”œâ”€â”€ prisma/
â”‚   â””â”€â”€ schema.prisma       # Additional models (if any)
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ ...                 # Module tests
â””â”€â”€ package.json            # Dependencies
```

### 4.3 Module Manifest

```json
{
  "name": "twicely-module-example",
  "version": "1.0.0",
  "displayName": "Example Module",
  "description": "Does something useful",
  "author": "Twicely",
  "license": "proprietary",
  "twicelyVersion": ">=2.0.0",
  "requiredPhases": [0, 1, 2, 3, 4],
  "dependencies": [],
  "permissions": [
    "listings:read",
    "listings:write"
  ],
  "healthProvider": "./src/health.ts",
  "routes": "./src/routes/index.ts",
  "adminUI": "./src/components/AdminPanel.tsx"
}
```

---

## 5. Timeline

| Milestone | Target | Status |
|-----------|--------|--------|
| Core platform (Phases 0-44) | MVP | In progress |
| Module runtime infrastructure | Post-MVP | Specified |
| First-party modules | Post-launch | Planned |
| Third-party module marketplace | Future | Conceptual |

---

## 6. Integration with Core Platform

### 6.1 Module Registration

Modules register via Phase 10 (System Health):
- Doctor discovers module health providers
- Module routes mounted under `/api/modules/{name}/`
- Module UI components rendered in designated slots

### 6.2 Module Isolation

Modules are sandboxed:
- Separate database schema prefix
- Limited to declared permissions
- Cannot modify core tables directly
- Must use provided APIs

### 6.3 Module Lifecycle

```
DISCOVERED â†’ VALIDATED â†’ INSTALLED â†’ ACTIVE â†’ DISABLED â†’ UNINSTALLED
                â†“
            REJECTED (validation failed)
```

---

## 8. Provider Interface Pattern

Some platform features are designed with **pluggable providers** - modules can implement core interfaces without modifying core code.

### 8.1 How It Works

```
CORE PLATFORM                          MODULE
┌────────────────────────┐            ┌────────────────────────┐
│ ShippingProviderInterface │ ◄─────── │ ShippoProvider         │
│ (contract only)          │ implements│ (actual implementation)│
└────────────────────────┘            └────────────────────────┘
         │                                      │
         ▼                                      ▼
┌────────────────────────┐            ┌────────────────────────┐
│ Provider Registry      │ ◄─────────  │ registerProvider()     │
│ getProvider('shipping')│  registers │                        │
└────────────────────────┘            └────────────────────────┘
```

### 8.2 Core Provider Registry

```typescript
// /lib/providers/registry.ts (in core)

type ProviderType = 'shipping' | 'payment' | 'notification' | 'search';

export function registerProvider(registration: {
  type: ProviderType;
  id: string;
  label: string;
  provider: unknown;
  priority?: number;
}): void;

export function unregisterProvider(type: ProviderType, id: string): void;

export function getProvider<T>(type: ProviderType): T | null;

export function getAllProviders<T>(type: ProviderType): Array<{ id: string; label: string; provider: T }>;

export function hasProvider(type: ProviderType): boolean;
```

### 8.3 Module Implementation

Modules declare what interfaces they provide in manifest:

```json
{
  "id": "shipping-shippo",
  "provides": ["ShippingProviderInterface", "doctor", "healthProvider"]
}
```

Modules register on init:

```typescript
// modules/shipping-shippo/src/index.ts

export function initModule(ctx) {
  ctx.providers.register('shipping', {
    type: 'shipping',
    id: 'shippo',
    label: 'Shippo',
    provider: new ShippoProvider(ctx),
    priority: 100,
  });
}
```

Modules unregister on uninstall:

```typescript
// modules/shipping-shippo/uninstall.ts

export async function uninstallModule(ctx) {
  ctx.providers?.unregister?.('shipping', 'shippo');
}
```

### 8.4 Core Usage

Core code uses providers without knowing which module provides them:

```typescript
// packages/core/shipping/service.ts

import { getProvider, hasProvider } from "@/lib/providers/registry";
import type { ShippingProviderInterface } from "@/shared/interfaces/ShippingProviderInterface";

export async function getShippingRates(params) {
  const provider = getProvider<ShippingProviderInterface>('shipping');
  
  if (!provider) {
    // No provider installed - fallback gracefully
    return [];
  }
  
  return provider.getRates(params);
}
```

### 8.5 Available Provider Interfaces

| Interface | Purpose | Status |
|-----------|---------|--------|
| `ShippingProviderInterface` | Rate shopping, label purchase, tracking | Phase 34 |
| `PaymentProviderInterface` | Payment processing beyond Stripe | Future |
| `NotificationProviderInterface` | SMS/Push beyond built-in | Future |
| `SearchProviderInterface` | Search beyond built-in | Future |
| `TaxProviderInterface` | Tax calculation services | Future |

### 8.6 Fallback Behavior

When no provider is installed, core handles gracefully:

| Feature | With Provider | Without Provider |
|---------|---------------|------------------|
| Rate shopping | Shows carrier rates | Hidden/disabled |
| Buy label | Purchases via provider | Not available |
| Tracking | Auto-updated via webhook | Manual entry only |
| Address validation | Validated via provider | Basic format check |

### 8.7 Multiple Providers

When multiple providers are installed, core can:
- Use the highest priority (lowest number) as default
- Query all providers for rate comparison
- Admin can select preferred provider

```typescript
// Get all providers for rate comparison
const allProviders = getAllProviders<ShippingProviderInterface>('shipping');

const allRates = [];
for (const { provider } of allProviders) {
  const rates = await provider.getRates(params);
  allRates.push(...rates);
}
```

---

## 9. For AI Agents: Key Takeaways

1. **Don't implement modules during Phase 0-44** - Focus on core platform
2. **Module specs are reference material** - Use when building modules later
3. **Module system is extensibility architecture** - Not MVP requirement
4. **Follow the template strictly** - Ensures compatibility
5. **Health providers are mandatory** - Every module must be monitorable

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-23 | Initial guidance document |
| 1.1 | 2026-01-24 | Added Provider Interface Pattern (Section 8) |

---

# END DOCUMENT
