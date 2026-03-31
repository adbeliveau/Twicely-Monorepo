import { describe, it, expect } from 'vitest';
import { formatTrustSignals, type BuyerTrustSignals } from '../buyer-quality';

describe('formatTrustSignals', () => {
  it('formats basic trust signals', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 47,
      memberSince: new Date('2024-03-15'),
      verified: true,
      repeatBuyer: false,
      returns90d: 0,
      disputes90d: 0,
    };

    expect(formatTrustSignals(signals)).toBe('47 purchases · Member since 2024 · Verified');
  });

  it('shows singular purchase', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 1,
      memberSince: new Date('2025-06-15'),
      verified: false,
      repeatBuyer: false,
      returns90d: 0,
      disputes90d: 0,
    };

    expect(formatTrustSignals(signals)).toBe('1 purchase · Member since 2025');
  });

  it('includes repeat buyer badge', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 12,
      memberSince: new Date('2023-06-01'),
      verified: true,
      repeatBuyer: true,
      returns90d: 0,
      disputes90d: 0,
    };

    expect(formatTrustSignals(signals)).toBe(
      '12 purchases · Member since 2023 · Verified · Bought from you before'
    );
  });

  it('shows returns and disputes when present', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 30,
      memberSince: new Date('2024-06-15'),
      verified: false,
      repeatBuyer: false,
      returns90d: 3,
      disputes90d: 1,
    };

    expect(formatTrustSignals(signals)).toBe(
      '30 purchases · Member since 2024 · 3 returns · 1 dispute'
    );
  });

  it('uses singular for 1 return and 1 dispute', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 5,
      memberSince: new Date('2025-02-01'),
      verified: true,
      repeatBuyer: false,
      returns90d: 1,
      disputes90d: 1,
    };

    expect(formatTrustSignals(signals)).toBe(
      '5 purchases · Member since 2025 · Verified · 1 return · 1 dispute'
    );
  });

  it('shows zero purchases correctly', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 0,
      memberSince: new Date('2026-03-31'),
      verified: false,
      repeatBuyer: false,
      returns90d: 0,
      disputes90d: 0,
    };

    expect(formatTrustSignals(signals)).toBe('0 purchases · Member since 2026');
  });

  it('shows all fields together', () => {
    const signals: BuyerTrustSignals = {
      completedPurchases: 100,
      memberSince: new Date('2022-06-15'),
      verified: true,
      repeatBuyer: true,
      returns90d: 2,
      disputes90d: 3,
    };

    expect(formatTrustSignals(signals)).toBe(
      '100 purchases · Member since 2022 · Verified · Bought from you before · 2 returns · 3 disputes'
    );
  });
});
