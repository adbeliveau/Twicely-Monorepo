import { describe, it, expect } from 'vitest';

describe('DSRBars Component Logic', () => {
  // Test the logic that determines whether to show the empty state
  function hasAnyData(metrics: { value: number | null }[]) {
    return metrics.some((m) => m.value !== null);
  }

  it('returns false when all metrics are null', () => {
    const metrics = [
      { key: 'avgItemAsDescribed', value: null },
      { key: 'avgShippingSpeed', value: null },
      { key: 'avgCommunication', value: null },
      { key: 'avgPackaging', value: null },
    ];

    expect(hasAnyData(metrics)).toBe(false);
  });

  it('returns true when at least one metric has data', () => {
    const metrics = [
      { key: 'avgItemAsDescribed', value: 4.5 },
      { key: 'avgShippingSpeed', value: null },
      { key: 'avgCommunication', value: null },
      { key: 'avgPackaging', value: null },
    ];

    expect(hasAnyData(metrics)).toBe(true);
  });

  it('returns true when all metrics have data', () => {
    const metrics = [
      { key: 'avgItemAsDescribed', value: 4.5 },
      { key: 'avgShippingSpeed', value: 4.2 },
      { key: 'avgCommunication', value: 4.8 },
      { key: 'avgPackaging', value: 4.0 },
    ];

    expect(hasAnyData(metrics)).toBe(true);
  });

  // Test bar width calculation
  it('calculates correct bar width percentage', () => {
    const calculateWidth = (value: number) => (value / 5) * 100;

    expect(calculateWidth(5)).toBe(100);
    expect(calculateWidth(4)).toBe(80);
    expect(calculateWidth(2.5)).toBe(50);
    expect(calculateWidth(1)).toBe(20);
  });

  // Test value formatting
  it('formats values to one decimal place', () => {
    const formatValue = (value: number) => value.toFixed(1);

    expect(formatValue(4.123)).toBe('4.1');
    expect(formatValue(3.999)).toBe('4.0');
    expect(formatValue(5.0)).toBe('5.0');
    expect(formatValue(2.5)).toBe('2.5');
  });
});
