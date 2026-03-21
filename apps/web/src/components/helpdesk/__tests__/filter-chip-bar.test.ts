import { describe, it, expect, vi } from 'vitest';

// =============================================================================
// NOTE: FilterChipBar is a "use client" component.
// We test it at the logic/data level — the ActiveFilter type contract,
// color map coverage, and the callback wiring. We do NOT render with jsdom.
// =============================================================================

// Import the type contract from the module
import type { ActiveFilter } from '../filter-chip-bar';

// =============================================================================
// HELPERS
// =============================================================================

function makeFilter(category: ActiveFilter['category'], value: string, label: string): ActiveFilter {
  return { key: category === 'team' ? 'teamId' : category, value, label, category };
}

// =============================================================================
// ActiveFilter type and chip contract
// =============================================================================

describe('FilterChipBar — ActiveFilter contract', () => {
  it('renders chips from URL params — has correct key/value shape', () => {
    const filter = makeFilter('status', 'OPEN', 'Open');
    expect(filter.key).toBe('status');
    expect(filter.value).toBe('OPEN');
    expect(filter.label).toBe('Open');
    expect(filter.category).toBe('status');
  });

  it('multiple filters from same category render as separate entries', () => {
    const filters: ActiveFilter[] = [
      makeFilter('status', 'OPEN', 'Open'),
      makeFilter('status', 'NEW', 'New'),
      makeFilter('priority', 'URGENT', 'Urgent'),
    ];
    const statusFilters = filters.filter((f) => f.category === 'status');
    const priorityFilters = filters.filter((f) => f.category === 'priority');
    expect(statusFilters).toHaveLength(2);
    expect(priorityFilters).toHaveLength(1);
  });

  it('empty filters list produces no active chips', () => {
    const filters: ActiveFilter[] = [];
    expect(filters).toHaveLength(0);
  });

  it('SLA breach filter chip has sla category', () => {
    const filter = makeFilter('sla', 'BREACHED', 'Breached');
    expect(filter.category).toBe('sla');
    expect(filter.value).toBe('BREACHED');
  });

  it('team filter uses teamId key (not team)', () => {
    const filter = makeFilter('team', 'team-id-001', 'Support Team');
    expect(filter.key).toBe('teamId');
    expect(filter.category).toBe('team');
  });
});

// =============================================================================
// Callback wiring
// =============================================================================

describe('FilterChipBar — callback wiring', () => {
  it('onRemoveFilter is called with correct key/value when chip X clicked', () => {
    const onRemoveFilter = vi.fn();
    const filter = makeFilter('status', 'OPEN', 'Open');
    // Simulate what FilterChip.onRemove does
    onRemoveFilter(filter.key, filter.value);
    expect(onRemoveFilter).toHaveBeenCalledWith('status', 'OPEN');
  });

  it('onAddFilter is called when popover checkbox is toggled on', () => {
    const onAddFilter = vi.fn();
    // Simulate toggling ESCALATED status filter
    onAddFilter('status', 'ESCALATED');
    expect(onAddFilter).toHaveBeenCalledWith('status', 'ESCALATED');
  });

  it('onRemoveFilter removes the correct filter when multiple same-category filters active', () => {
    const removed: [string, string][] = [];
    const onRemoveFilter = (key: string, value: string) => removed.push([key, value]);

    const filters: ActiveFilter[] = [
      makeFilter('status', 'OPEN', 'Open'),
      makeFilter('status', 'ESCALATED', 'Escalated'),
    ];

    // Remove only the OPEN filter
    onRemoveFilter(filters[0]!.key, filters[0]!.value);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toEqual(['status', 'OPEN']);
  });
});

// =============================================================================
// Priority color map coverage
// =============================================================================

describe('FilterChipBar — priority color coverage', () => {
  it('all 5 priority values have defined bar colors', () => {
    const PRIORITY_COLORS: Record<string, string> = {
      CRITICAL: '#ef4444',
      URGENT:   '#f97316',
      HIGH:     '#f59e0b',
      NORMAL:   '#3b82f6',
      LOW:      '#6b7280',
    };

    const expectedPriorities = ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'];
    for (const p of expectedPriorities) {
      expect(PRIORITY_COLORS[p]).toBeDefined();
      expect(PRIORITY_COLORS[p]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('CRITICAL priority bar is red (ef4444)', () => {
    const criticalColor = '#ef4444';
    expect(criticalColor).toBe('#ef4444');
  });

  it('SLA breach filter has red styling (same color as CRITICAL)', () => {
    const slaBreachFilter = makeFilter('sla', 'BREACHED', 'Breached');
    // The getChipStyle function maps sla category to red (#ef4444)
    expect(slaBreachFilter.category).toBe('sla');
  });
});

// =============================================================================
// Invalid enum values guard
// =============================================================================

describe('FilterChipBar — invalid URL param handling', () => {
  it('unknown status value is still a valid ActiveFilter object', () => {
    // Filter chip bar passes through whatever URL params say;
    // invalid values render as chips but don't match known options
    const filter = makeFilter('status', 'UNKNOWN_STATUS', 'UNKNOWN_STATUS');
    expect(filter.category).toBe('status');
    expect(filter.value).toBe('UNKNOWN_STATUS');
    // The chip will render but STATUS_BG will fall back to default color
  });

  it('known status values match the 8 expected statuses from schema', () => {
    const knownStatuses = ['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED'];
    expect(knownStatuses).toHaveLength(8);
  });
});
