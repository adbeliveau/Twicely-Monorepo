# TWICELY — MODULE INSTALLER UI CANONICAL (v1)

## PURPOSE
Define the **standard Admin UI** for installing, updating, disabling, and uninstalling modules in Twicely.

This UI is the only supported way for non-developers to manage modules.
All actions must be **safe, non-destructive by default**, and **SUPER_ADMIN-gated** where required.

This document is module-agnostic.

---

## RBAC / PERMISSIONS (REQUIRED)
Permissions must be checked server-side and in UI.

- `modules.view` (ADMIN+)
- `modules.install` (SUPER_ADMIN)
- `modules.disable` (SUPER_ADMIN)
- `modules.uninstall` (SUPER_ADMIN)
- `modules.update` (SUPER_ADMIN)
- `modules.runDoctor` (ADMIN+)

Notes:
- If your platform uses different permission codes, map these to your core scheme.
- UI must hide or disable controls if user lacks permission.
- Server must enforce permissions even if UI is bypassed.

---

## ROUTES (RECOMMENDED)
- `/admin/modules` — Modules Dashboard
- `/admin/modules/install` — Install from ZIP
- `/admin/modules/[moduleId]` — Module Details
- `/admin/modules/[moduleId]/update` — Update Module
- `/admin/modules/[moduleId]/doctor` — Module Diagnostics (Doctor)

---

## MODULES DASHBOARD UI (`/admin/modules`)

### Layout
A table or cards showing all known modules (installed + discovered).

Columns:
- Name
- Module ID
- Version
- Status: ENABLED / DISABLED / MISSING / INCOMPATIBLE
- Health: Green/Yellow/Red/Grey (if provider exists)
- Last Updated
- Actions

Actions:
- View (ADMIN+)
- Disable (SUPER_ADMIN)
- Enable (SUPER_ADMIN)
- Update (SUPER_ADMIN)
- Uninstall (SUPER_ADMIN)

### Status Semantics
- ENABLED: module active
- DISABLED: module installed but inactive (no hooks/scheduler/UI mounted)
- MISSING: module listed but code not present (do not crash)
- INCOMPATIBLE: version mismatch with platformCompatibility

---

## INSTALL FLOW UI (`/admin/modules/install`)

### Install Source
V1 supports:
- Upload ZIP
- (Optional) Paste URL to ZIP (server downloads)

### ZIP VALIDATION (REQUIRED)
Before install, validate:
- ZIP contains exactly one top-level module folder OR a manifest at root
- `manifest.json` exists
- `manifest.id` is valid and immutable
- `manifest.version` is valid semver
- module does not attempt to write outside module directory
- no executable binaries included (optional policy)

### Install Preview Screen (REQUIRED)
Show:
- Module Name / ID / Version
- Declared permissions
- Declared routes/UI mounts (if manifest includes)
- Declared tables/migrations (CREATE IF NOT EXISTS only)
- Requires / Provides
- Compatibility check result

Buttons:
- Cancel
- Install (SUPER_ADMIN only)

### Install Execution
- Run `install.ts` idempotently
- On success: register module state ENABLED (or ask enable toggle)
- On failure: do not register; show error with copyable details

UI must provide:
- “Copy install log”
- “Download install report JSON”

---

## UPDATE FLOW UI (`/admin/modules/[moduleId]/update`)

### Update Sources
- Upload ZIP
- Optional: URL

### Update Safety Rules
- Update must preserve settings and historical data
- Update must be backward compatible
- Update must not auto-delete tables or data

### Update Preview Screen (REQUIRED)
Show:
- Current version → New version
- Compatibility status
- Settings schema changes (if provided)
- New permissions (if any) — idempotent add only
- Migration notes (CREATE IF NOT EXISTS only)

Buttons:
- Cancel
- Apply Update (SUPER_ADMIN only)

### Post-Update
- Mark new version
- Run module doctor automatically (optional) or prompt “Run Doctor”
- If doctor FAIL: suggest Disable module

---

## DISABLE / ENABLE UI (`/admin/modules/[moduleId]`)

Disable semantics:
- Stop schedulers/hooks
- Hide admin UI mounts
- Keep data

Enable semantics:
- Re-register hooks
- Resume schedulers
- UI mounts restored

Buttons:
- Disable (SUPER_ADMIN)
- Enable (SUPER_ADMIN)

---

## UNINSTALL UI (`/admin/modules/[moduleId]`)

Uninstall must be **two-step confirmation**.

Step 1: Disable module (required)
Step 2: Confirm uninstall:
- Checkbox: “I understand uninstall is non-destructive by default.”
- Optional checkbox: “Delete module settings entry”
- Advanced (OFF by default): “Purge module data”
  - Requires second confirm and explicit typing of module ID

Rules:
- Default uninstall does NOT delete tables/data.
- Purge is explicit, dangerous, and separate.

---

## MODULE DOCTOR UI (`/admin/modules/[moduleId]/doctor`)

Doctor is read-only diagnostics:
- List checks PASS/WARN/FAIL
- Show last run timestamp
- “Run now” (ADMIN+)
- “Copy report” JSON
- “Open related subsystem” links (if provider supports)

Doctor FAIL should show:
- Recommended action: Disable module
- Links to docs

---

## SYSTEM HEALTH INTEGRATION (OPTIONAL)
If platform has System Health:
- Module tile shows health status
- Module detail page links to System Health provider page

---

## EXPORT / REPORTING
Every install/update/uninstall action must produce a report object:
- action
- moduleId
- fromVersion/toVersion
- timestamp
- userId
- result (success/fail)
- logs (redact secrets)

Provide:
- Copy to clipboard
- Download JSON

END OF CANONICAL
