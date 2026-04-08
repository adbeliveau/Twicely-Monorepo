/**
 * Edge-case tests for search multiplier, band derivation, and calculateTrend (G4.1).
 * Split from calculate-seller-score-edge.test.ts for file size compliance.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSearchMultiplier,
  calculateTrend,
  deriveBand,
} from '../calculate-seller-score';
import type { BandThresholds } from '../score-types';

const DEFAULT_THRESHOLDS: BandThresholds = { powerSeller: 900, topRated: 750, established: 550 };

// ── Search multiplier: exact spec §3.3 boundary values ───────────────────────

describe('calculateSearchMultiplier — spec §3.3 exact table values', () => {
  // Non-suspended, established sellers (50+ orders)
  it('score 480 → multiplier clamped to 0.60 (floor)', () => {
    expect(calculateSearchMultiplier(480, false, 100, 10, 50)).toBeCloseTo(0.60, 5);
  });

  it('score 500 → multiplier 0.625', () => {
    expect(calculateSearchMultiplier(500, false, 100, 10, 50)).toBeCloseTo(0.625, 5);
  });

  it('score 549 → multiplier ~0.686', () => {
    expect(calculateSearchMultiplier(549, false, 100, 10, 50)).toBeCloseTo(549 / 800, 5);
  });

  it('score 550 → multiplier ~0.6875 (exact boundary ESTABLISHED)', () => {
    expect(calculateSearchMultiplier(550, false, 100, 10, 50)).toBeCloseTo(550 / 800, 5);
  });

  it('score 749 → multiplier ~0.936 (just below TOP_RATED boundary)', () => {
    expect(calculateSearchMultiplier(749, false, 100, 10, 50)).toBeCloseTo(749 / 800, 5);
  });

  it('score 750 → multiplier ~0.9375 (exact TOP_RATED threshold — continuous, no cliff)', () => {
    const mult749 = calculateSearchMultiplier(749, false, 100, 10, 50);
    const mult750 = calculateSearchMultiplier(750, false, 100, 10, 50);
    const diff = mult750 - mult749;
    expect(diff).toBeCloseTo(1 / 800, 5);
  });

  it('score 899 → multiplier ~1.124 (just below POWER_SELLER boundary)', () => {
    expect(calculateSearchMultiplier(899, false, 100, 10, 50)).toBeCloseTo(899 / 800, 5);
  });

  it('score 900 → multiplier ~1.125 (POWER_SELLER — continuous no cliff)', () => {
    const mult899 = calculateSearchMultiplier(899, false, 100, 10, 50);
    const mult900 = calculateSearchMultiplier(900, false, 100, 10, 50);
    const diff = mult900 - mult899;
    expect(diff).toBeCloseTo(1 / 800, 5);
  });

  it('score 1000 → multiplier clamped to 1.25 (ceiling)', () => {
    expect(calculateSearchMultiplier(1000, false, 100, 10, 50)).toBeCloseTo(1.25, 5);
  });
});

describe('calculateSearchMultiplier — transition seller boundaries', () => {
  it('orderCount 49 is still in transition zone (clamped 0.95-1.10)', () => {
    expect(calculateSearchMultiplier(0, false, 49, 10, 50)).toBeCloseTo(0.95, 5);
    expect(calculateSearchMultiplier(1000, false, 49, 10, 50)).toBeCloseTo(1.10, 5);
  });

  it('orderCount 50 exits transition zone — full range 0.60-1.25 applies', () => {
    expect(calculateSearchMultiplier(0, false, 50, 10, 50)).toBeCloseTo(0.60, 5);
    expect(calculateSearchMultiplier(1000, false, 50, 10, 50)).toBeCloseTo(1.25, 5);
  });

  it('orderCount exactly 10 is new seller (< newSellerThreshold) → 1.0', () => {
    expect(calculateSearchMultiplier(800, false, 10, 10, 50)).toBeCloseTo(1.0, 5);
  });

  it('orderCount 9 is new seller → always 1.0 regardless of score', () => {
    expect(calculateSearchMultiplier(0, false, 9, 10, 50)).toBe(1.0);
    expect(calculateSearchMultiplier(1000, false, 9, 10, 50)).toBe(1.0);
  });
});

// ── Band derivation at exact thresholds ──────────────────────────────────────

describe('deriveBand — exact threshold boundaries (spec §3.1)', () => {
  it('score 549 → EMERGING (one below ESTABLISHED)', () => {
    expect(deriveBand(549, DEFAULT_THRESHOLDS)).toBe('EMERGING');
  });

  it('score 550 → ESTABLISHED (exact threshold)', () => {
    expect(deriveBand(550, DEFAULT_THRESHOLDS)).toBe('ESTABLISHED');
  });

  it('score 749 → ESTABLISHED (one below TOP_RATED)', () => {
    expect(deriveBand(749, DEFAULT_THRESHOLDS)).toBe('ESTABLISHED');
  });

  it('score 750 → TOP_RATED (exact threshold)', () => {
    expect(deriveBand(750, DEFAULT_THRESHOLDS)).toBe('TOP_RATED');
  });

  it('score 899 → TOP_RATED (one below POWER_SELLER)', () => {
    expect(deriveBand(899, DEFAULT_THRESHOLDS)).toBe('TOP_RATED');
  });

  it('score 900 → POWER_SELLER (exact threshold)', () => {
    expect(deriveBand(900, DEFAULT_THRESHOLDS)).toBe('POWER_SELLER');
  });
});

// ── calculateTrend edge cases ─────────────────────────────────────────────────

describe('calculateTrend — edge cases', () => {
  it('returns STEADY for empty array', () => {
    expect(calculateTrend([])).toBe('STEADY');
  });

  it('returns STEADY for single-element array', () => {
    expect(calculateTrend([700])).toBe('STEADY');
  });

  it('returns STEADY for two identical scores', () => {
    expect(calculateTrend([600, 600])).toBe('STEADY');
  });

  it('boundary: delta exactly 50 → SURGING', () => {
    expect(calculateTrend([600, 650])).toBe('SURGING');
  });

  it('boundary: delta exactly 49 → CLIMBING', () => {
    expect(calculateTrend([600, 649])).toBe('CLIMBING');
  });

  it('boundary: delta exactly -50 → DECLINING', () => {
    expect(calculateTrend([650, 600])).toBe('DECLINING');
  });

  it('boundary: delta exactly -49 → SLIPPING', () => {
    expect(calculateTrend([649, 600])).toBe('SLIPPING');
  });

  it('boundary: delta exactly 10 → CLIMBING', () => {
    expect(calculateTrend([600, 610])).toBe('CLIMBING');
  });

  it('boundary: delta exactly -10 → SLIPPING', () => {
    expect(calculateTrend([610, 600])).toBe('SLIPPING');
  });
});
