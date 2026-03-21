/**
 * V3 Permission Registry (A4.1)
 * Types, category labels, and helper functions for the custom role system.
 * Module data is split into permission-registry-data.ts to stay under 300 lines.
 *
 * All subjects must exist in subjects.ts SUBJECTS array.
 * Actions include both the typed 5 (read/create/update/delete/manage)
 * and semantic extras used in the Actors Canonical Section 4.3.4.
 */

export interface PermissionAction {
  /** CASL action string, e.g. 'read' */
  action: string;
  /** Display label for admin UI, e.g. 'View' */
  label: string;
}

export interface PermissionModule {
  /** CASL subject string, e.g. 'Order' */
  subject: string;
  /** Display name, e.g. 'Orders' */
  name: string;
  /** Description for admin UI */
  description: string;
  /** Category for grouping */
  category: PermissionCategory;
  /** All available actions for this subject */
  actions: PermissionAction[];
}

export type PermissionCategory =
  | 'USERS_AND_STAFF'
  | 'COMMERCE'
  | 'FINANCE'
  | 'TRUST_AND_SAFETY'
  | 'CONTENT'
  | 'PLATFORM'
  | 'CROSSLISTER'
  | 'AFFILIATE'
  | 'LOCAL';

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  USERS_AND_STAFF: 'Users & Staff',
  COMMERCE: 'Commerce',
  FINANCE: 'Finance',
  TRUST_AND_SAFETY: 'Trust & Safety',
  CONTENT: 'Content & Communication',
  PLATFORM: 'Platform Configuration',
  CROSSLISTER: 'Crosslister',
  AFFILIATE: 'Affiliate Program',
  LOCAL: 'Local Transactions',
};

// Merge base + extended + domain module data so consumers import from a single location
import { PERMISSION_MODULES as _BASE } from './permission-registry-data';
import { PERMISSION_MODULES_EXTENDED as _EXT } from './permission-registry-data-extended';
import { PERMISSION_MODULES_DOMAINS as _DOM } from './permission-registry-data-domains';

const _MODULES: PermissionModule[] = [..._BASE, ..._EXT, ..._DOM];
export const PERMISSION_MODULES = _MODULES;

// ─── Derived helpers ──────────────────────────────────────────────────────────

/**
 * Build a set of valid "subject:action" pairs for fast lookup.
 */
const VALID_PAIRS = new Set<string>(
  _MODULES.flatMap((m) =>
    m.actions.map((a) => `${m.subject}:${a.action}`)
  )
);

/**
 * Get all modules grouped by category.
 */
export function getModulesByCategory(): Map<PermissionCategory, PermissionModule[]> {
  const map = new Map<PermissionCategory, PermissionModule[]>();
  for (const mod of _MODULES) {
    const existing = map.get(mod.category) ?? [];
    existing.push(mod);
    map.set(mod.category, existing);
  }
  return map;
}

/**
 * Flat array of all valid { subject, action } pairs.
 */
export function getAllPermissionPairs(): Array<{ subject: string; action: string }> {
  return _MODULES.flatMap((m) =>
    m.actions.map((a) => ({ subject: m.subject, action: a.action }))
  );
}

/**
 * Validate a permissions array against the registry.
 * Returns { valid: true } if all pairs are known, or { valid: false, errors } listing unknowns.
 */
export function validatePermissions(
  permissions: Array<{ subject: string; action: string }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const perm of permissions) {
    const key = `${perm.subject}:${perm.action}`;
    if (!VALID_PAIRS.has(key)) {
      errors.push(`Invalid permission: ${perm.subject}.${perm.action}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
