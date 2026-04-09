# TWICELY — AI MODULE VALIDATION CHECKLIST (v1)
*(Use this to validate any AI-generated module before accepting it.)*

## RULE
If any REQUIRED item fails, the output is INVALID and must be rejected.

---

## A) STRUCTURE (REQUIRED)
- [ ] Module folder exists at `modules/<module-slug>/`
- [ ] `manifest.json` exists and includes: id, label, version, platformCompatibility
- [ ] `src/index.ts` exists and exports a single module entry (init/register)
- [ ] `install.ts` exists and is idempotent
- [ ] `uninstall.ts` exists and is safe/non-destructive by default
- [ ] No files write outside the module directory

---

## B) SAFETY (REQUIRED)
- [ ] No `prisma db push` instructions or code
- [ ] No schema edits required to function (Prisma schema changes forbidden)
- [ ] Any SQL is CREATE IF NOT EXISTS only
- [ ] No destructive SQL (DROP/TRUNCATE/DELETE) unless explicitly purge-only and double-confirmed
- [ ] No auto-fix actions in doctors/health checks
- [ ] Failures do not crash platform; module fails gracefully

---

## C) RBAC (REQUIRED)
- [ ] Permissions are registered idempotently
- [ ] Permissions are checked server-side on all admin routes
- [ ] SUPER_ADMIN cannot be locked out
- [ ] Uninstall/disable/update actions require SUPER_ADMIN

---

## D) INSTALL / UPDATE / UNINSTALL (REQUIRED)
- [ ] Install can be rerun safely (idempotent)
- [ ] Update preserves settings and historical data
- [ ] Provider settings schema is backward compatible (defaults + accepts unknown)
- [ ] Uninstall is non-destructive by default
- [ ] Purge is optional, OFF by default, and requires explicit confirmation

---

## E) HEALTH / DOCTOR (RECOMMENDED; REQUIRED IF MODULE HAS RUNTIME BEHAVIOR)
- [ ] A doctor exists for runtime behavior modules
- [ ] Doctor returns PASS/WARN/FAIL/UNKNOWN with reasons
- [ ] Doctor is read-only
- [ ] Module integrates with System Health provider contract if applicable

---

## F) ZIP PACKAGING (REQUIRED)
- [ ] ZIP contains only the module folder and required files
- [ ] ZIP includes manifest and install scripts
- [ ] ZIP does not include node_modules or secrets
- [ ] README includes a single “Install Prompt” copy/paste block

---

## G) UI/ROUTES (REQUIRED IF MODULE HAS UI)
- [ ] Admin pages are mounted under /admin/*
- [ ] All pages enforce admin permissions
- [ ] Any “Install/Update/Uninstall” UI requires SUPER_ADMIN
- [ ] UI provides “copy report” / “download report”

---

## H) LOGGING (REQUIRED)
- [ ] Logs redact secrets
- [ ] Errors are returned in standard envelope
- [ ] Action reports exist for install/update/uninstall

---

## ACCEPTANCE
- If all REQUIRED checks pass, accept module.
- If any REQUIRED check fails, reject and request fixes.

END OF CHECKLIST
