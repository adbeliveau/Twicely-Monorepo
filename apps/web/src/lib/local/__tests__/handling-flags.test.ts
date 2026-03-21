import { describe, it, expect } from 'vitest';
import {
  LOCAL_HANDLING_FLAGS,
  HANDLING_FLAG_LABELS,
  HANDLING_FLAG_SHORT_LABELS,
} from '../handling-flags';

describe('handling-flags', () => {
  it('LOCAL_HANDLING_FLAGS has exactly 4 entries', () => {
    expect(LOCAL_HANDLING_FLAGS).toHaveLength(4);
  });

  it('HANDLING_FLAG_LABELS has entry for every flag', () => {
    for (const flag of LOCAL_HANDLING_FLAGS) {
      expect(HANDLING_FLAG_LABELS[flag]).toBeDefined();
      expect(typeof HANDLING_FLAG_LABELS[flag]).toBe('string');
      expect(HANDLING_FLAG_LABELS[flag].length).toBeGreaterThan(0);
    }
  });

  it('HANDLING_FLAG_SHORT_LABELS has entry for every flag', () => {
    for (const flag of LOCAL_HANDLING_FLAGS) {
      expect(HANDLING_FLAG_SHORT_LABELS[flag]).toBeDefined();
      expect(typeof HANDLING_FLAG_SHORT_LABELS[flag]).toBe('string');
      expect(HANDLING_FLAG_SHORT_LABELS[flag].length).toBeGreaterThan(0);
    }
  });

  it('all 4 flag values match expected strings', () => {
    expect(LOCAL_HANDLING_FLAGS[0]).toBe('NEEDS_VEHICLE');
    expect(LOCAL_HANDLING_FLAGS[1]).toBe('NEEDS_HELP');
    expect(LOCAL_HANDLING_FLAGS[2]).toBe('NEEDS_DISASSEMBLY');
    expect(LOCAL_HANDLING_FLAGS[3]).toBe('NEEDS_EQUIPMENT');
  });
});
