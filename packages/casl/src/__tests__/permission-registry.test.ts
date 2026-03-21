/**
 * Tests for the V3 permission registry (A4.1)
 */

import { describe, test, expect } from 'vitest';
import {
  PERMISSION_MODULES,
  getAllPermissionPairs,
  getModulesByCategory,
  validatePermissions,
} from '../permission-registry';
import { SUBJECTS } from '../subjects';

describe('Permission registry — module subjects', () => {
  test('All subjects in PERMISSION_MODULES exist in the SUBJECTS array from subjects.ts', () => {
    const subjectSet = new Set<string>(SUBJECTS);
    for (const mod of PERMISSION_MODULES) {
      expect(
        subjectSet.has(mod.subject),
        `Module subject "${mod.subject}" is not in SUBJECTS array`
      ).toBe(true);
    }
  });
});

describe('validatePermissions', () => {
  test('returns valid for known subject+action pairs', () => {
    const result = validatePermissions([
      { subject: 'Order', action: 'read' },
      { subject: 'User', action: 'warn' },
      { subject: 'Payout', action: 'execute' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('returns errors for unknown subjects', () => {
    const result = validatePermissions([
      { subject: 'NonExistentSubject', action: 'read' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('NonExistentSubject');
  });

  test('returns errors for unknown actions on a subject', () => {
    const result = validatePermissions([
      { subject: 'Order', action: 'fly' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Order.fly');
  });

  test('returns errors for both unknown subject and unknown action', () => {
    const result = validatePermissions([
      { subject: 'FakeSubject', action: 'fakedo' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe('getAllPermissionPairs', () => {
  test('returns the correct total count (at least one pair per module)', () => {
    const pairs = getAllPermissionPairs();
    // Every module has at least one action, so pairs count >= module count
    expect(pairs.length).toBeGreaterThanOrEqual(PERMISSION_MODULES.length);
    // Each pair has subject and action fields
    for (const pair of pairs) {
      expect(pair).toHaveProperty('subject');
      expect(pair).toHaveProperty('action');
      expect(typeof pair.subject).toBe('string');
      expect(typeof pair.action).toBe('string');
    }
  });
});

describe('getModulesByCategory', () => {
  test('returns all 9 categories', () => {
    const map = getModulesByCategory();
    expect(map.has('USERS_AND_STAFF')).toBe(true);
    expect(map.has('COMMERCE')).toBe(true);
    expect(map.has('FINANCE')).toBe(true);
    expect(map.has('TRUST_AND_SAFETY')).toBe(true);
    expect(map.has('CONTENT')).toBe(true);
    expect(map.has('PLATFORM')).toBe(true);
    expect(map.has('CROSSLISTER')).toBe(true);
    expect(map.has('AFFILIATE')).toBe(true);
    expect(map.has('LOCAL')).toBe(true);
  });
});

describe('Permission registry — coverage', () => {
  test('No duplicate subjects in PERMISSION_MODULES', () => {
    const subjects = PERMISSION_MODULES.map((m) => m.subject);
    const unique = new Set(subjects);
    expect(subjects.length).toBe(unique.size);
  });

  test('Every admin-relevant subject in SUBJECTS is in the registry', () => {
    const registeredSubjects = new Set(PERMISSION_MODULES.map((m) => m.subject));
    // User-only subjects intentionally excluded from the admin registry
    const excluded = new Set(['Cart', 'Watchlist', 'BrowsingHistory']);
    for (const subject of SUBJECTS) {
      if (excluded.has(subject)) continue;
      expect(
        registeredSubjects.has(subject),
        `Subject "${subject}" is in SUBJECTS but missing from PERMISSION_MODULES`
      ).toBe(true);
    }
  });
});
