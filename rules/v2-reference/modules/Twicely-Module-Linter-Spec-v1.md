# TWICELY -- MODULE LINTER SPEC (v1)
*(Auto-reject unsafe module ZIPs before install/update)*

## Purpose
The Module Linter is a **pre-install gate**. It validates:
- Structure
- Safety constraints
- Manifest correctness
- Forbidden content (secrets, node_modules, destructive SQL)

It must run for:
- Install ZIP uploads
- Update ZIP uploads

If any **BLOCKER** fails, installation/update must be refused.

---

## Input
- A ZIP file uploaded via Admin Module Installer

---

## Output
A report object:

```ts
export type LintSeverity = "INFO" | "WARN" | "BLOCKER";

export type LintFinding = {
 severity: LintSeverity;
 code: string;
 message: string;
 path?: string;
};

export type ModuleLintReport = {
 ok: boolean; // false if any BLOCKER
 moduleId?: string;
 version?: string;
 findings: LintFinding[];
};
```
---

## BLOCKERS (must refuse install/update)

### B1) Missing required files
- `manifest.json` missing
- `install.ts` missing
- `uninstall.ts` missing
- `src/index.ts` missing
- `README.md` missing

### B2) Invalid manifest
- Missing `id`, `label`, `version`, `platformCompatibility`
- `id` contains unsafe characters or path traversal
- `version` not valid semver

### B3) Unsafe ZIP layout
- ZIP contains files outside `modules/<id>/...` (path traversal / multiple roots)
- Multiple module roots in one zip (unless explicitly supported)
- Absolute paths in entries

### B4) Forbidden directories / files
- `node_modules/`
- `.env`, `.env.*`
- `*.pem`, `id_rsa`, `*.key`
- `*.p12`
- Any file larger than configured max (default 10MB) unless allowlisted

### B5) Forbidden code patterns (best-effort static scan)
- `prisma db push`
- `prisma migrate dev`
- `DROP TABLE` outside purge paths (heuristic)
- `TRUNCATE`
- `DELETE FROM` without a WHERE (heuristic)

### B6) Forbidden SQL (non-purge)
- In `migrations/*.sql`, detect:
 - DROP
 - TRUNCATE
 - DELETE
 - ALTER... DROP
 - UPDATE without WHERE (optional heuristic)

---

## WARNINGS (allowed but shown)

- Missing doctor folder for runtime module (heuristic)
- No health provider present (optional)
- Missing license header (optional)
- Large number of files

---

## Heuristic rules
- If `migrations/` exists, all SQL must be CREATE IF NOT EXISTS only
- If purge support exists, it must be in `uninstall.ts` and OFF by default

---

## Example Linter Implementation Outline (Node)

```ts
import AdmZip from "adm-zip";
import semver from "semver";

export function lintModuleZip(buffer: Buffer): ModuleLintReport {
 const zip = new AdmZip(buffer);
 const entries = zip.getEntries();

 // 1) path traversal guard
 // 2) locate manifest.json
 // 3) validate semver + id
 // 4) required files exist
 // 5) forbidden dirs/files
 // 6) scan SQL and TS for patterns (best-effort)
 // return report
}
```

END OF SPEC
