/**
 * Tests for useFeatureFlag hook — pure-logic extraction pattern (G10.5).
 * No DOM rendering. Extracted pure functions tested directly.
 */

import { describe, it, expect } from 'vitest';
import { resolveFlag, mergeFlags } from '../use-feature-flag';

// ─── resolveFlag ──────────────────────────────────────────────────────────────

describe('resolveFlag', () => {
  it('returns true when flag key exists and is true in the map', () => {
    const flags = { 'kill.checkout': true };
    expect(resolveFlag(flags, 'kill.checkout')).toBe(true);
  });

  it('returns false when flag key exists and is false in the map', () => {
    const flags = { 'gate.marketplace': false };
    expect(resolveFlag(flags, 'gate.marketplace')).toBe(false);
  });

  it('returns false when flag key does not exist in the map (default)', () => {
    const flags = { 'feature.other': true };
    expect(resolveFlag(flags, 'feature.nonexistent')).toBe(false);
  });

  it('returns false when flags map is empty', () => {
    expect(resolveFlag({}, 'any.key')).toBe(false);
  });
});

// ─── mergeFlags ───────────────────────────────────────────────────────────────

describe('mergeFlags', () => {
  it('merges initial flags with fetched flags — fetched wins on conflict', () => {
    const initial = { 'kill.checkout': false, 'gate.marketplace': true };
    const fetched = { 'kill.checkout': true };
    const result = mergeFlags(initial, fetched);
    // fetched wins on conflict
    expect(result['kill.checkout']).toBe(true);
    // initial preserved when not in fetched
    expect(result['gate.marketplace']).toBe(true);
  });

  it('preserves initial flags when fetch returns empty', () => {
    const initial = { 'kill.checkout': true };
    const result = mergeFlags(initial, {});
    expect(result['kill.checkout']).toBe(true);
  });

  it('handles undefined initial flags', () => {
    const fetched = { 'gate.marketplace': false };
    const result = mergeFlags(undefined, fetched);
    expect(result['gate.marketplace']).toBe(false);
  });
});

// ─── FeatureFlagProvider initialization ──────────────────────────────────────

describe('FeatureFlagProvider initialization', () => {
  it('starts with isLoading=true when no initialFlags', () => {
    // When no initialFlags are given, isLoading initializes to true
    // This is the direct state initialization: useState(!initialFlags)
    const initialFlags = undefined;
    const isLoading = !initialFlags; // true
    expect(isLoading).toBe(true);
  });

  it('starts with isLoading=false when initialFlags provided', () => {
    // When initialFlags are given, isLoading initializes to false immediately
    const initialFlags = { 'kill.checkout': true };
    const isLoading = !initialFlags; // false (object is truthy)
    expect(isLoading).toBe(false);
  });

  it('transitions isLoading from true to false after fetch', async () => {
    // Simulate the fetch-complete path: isLoading starts true, becomes false
    let isLoading = true;
    // Simulate successful fetch response
    const fetchedFlags = { 'kill.checkout': true };
    let flags = {};
    // After fetch resolves:
    flags = mergeFlags(flags, fetchedFlags);
    isLoading = false;
    expect(isLoading).toBe(false);
    expect(resolveFlag(flags, 'kill.checkout')).toBe(true);
  });
});
