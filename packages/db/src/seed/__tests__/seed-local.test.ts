import { describe, it, expect } from 'vitest';
import { seedLocalMeetupLocations, SEED_LOCATIONS } from '../seed-local';

describe('seed-local', () => {
  it('exports seed function', () => {
    expect(typeof seedLocalMeetupLocations).toBe('function');
  });

  it('defines 5 seed locations', () => {
    expect(SEED_LOCATIONS).toHaveLength(5);
  });

  it('all locations have required fields (name, address, city, state, zip, lat, lng, type)', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(loc.name.length, `missing name`).toBeGreaterThan(0);
      expect(loc.address.length, `missing address for ${loc.name}`).toBeGreaterThan(0);
      expect(loc.city.length, `missing city for ${loc.name}`).toBeGreaterThan(0);
      expect(loc.state.length, `missing state for ${loc.name}`).toBeGreaterThan(0);
      expect(loc.zip.length, `missing zip for ${loc.name}`).toBeGreaterThan(0);
      expect(typeof loc.latitude, `latitude must be number for ${loc.name}`).toBe('number');
      expect(typeof loc.longitude, `longitude must be number for ${loc.name}`).toBe('number');
      expect(loc.type.length, `missing type for ${loc.name}`).toBeGreaterThan(0);
    }
  });

  it('operating hours format is valid JSON', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(
        typeof loc.operatingHoursJson,
        `operatingHoursJson must be object for ${loc.name}`
      ).toBe('object');
      expect(
        loc.operatingHoursJson,
        `operatingHoursJson must not be null for ${loc.name}`
      ).not.toBeNull();
      // Verify it serializes and parses round-trip
      const serialized = JSON.stringify(loc.operatingHoursJson);
      expect(() => JSON.parse(serialized)).not.toThrow();
    }
  });
});
