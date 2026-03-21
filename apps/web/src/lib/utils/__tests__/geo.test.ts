import { describe, it, expect } from 'vitest';
import { haversineDistanceMiles } from '../geo';

describe('haversineDistanceMiles', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMiles(0, 0, 0, 0)).toBe(0);
  });

  it('returns approximately 2451 miles for NYC to LA', () => {
    // NYC: 40.7128, -74.0060 / LA: 34.0522, -118.2437
    const distance = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(2440);
    expect(distance).toBeLessThan(2461);
  });

  it('returns approximately 1.0 for known 1-mile-apart points', () => {
    // Two points ~1 mile apart along the equator (roughly 0.01449 degrees per mile)
    const distance = haversineDistanceMiles(0, 0, 0, 0.01449);
    expect(distance).toBeGreaterThanOrEqual(0.9);
    expect(distance).toBeLessThanOrEqual(1.1);
  });

  it('returns a number rounded to 1 decimal place', () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437);
    const asString = distance.toString();
    // Check that there is at most 1 decimal place
    const parts = asString.split('.');
    if (parts.length === 2) {
      expect(parts[1]!.length).toBeLessThanOrEqual(1);
    } else {
      // Integer result is also valid (0 decimals)
      expect(parts.length).toBe(1);
    }
  });
});
