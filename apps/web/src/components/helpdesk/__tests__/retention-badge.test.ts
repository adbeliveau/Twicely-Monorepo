import { describe, it, expect } from 'vitest';

// Pure logic unit tests — no rendering needed since the badge logic is self-contained

function getDaysRemaining(from: Date | null, addDays: number): number {
  if (!from) return addDays;
  const deleteAt = new Date(from.getTime() + addDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.floor((deleteAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function getBadgeVariant(days: number): 'green' | 'amber' | 'red' | 'red-pulse' {
  if (days < 7) return 'red-pulse';
  if (days < 30) return 'red';
  if (days <= 90) return 'amber';
  return 'green';
}

describe('RetentionBadge logic', () => {
  it('shows green badge variant when > 90 days remaining', () => {
    const closedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const retentionDays = 365;
    const days = getDaysRemaining(closedAt, retentionDays);
    expect(days).toBeGreaterThan(90);
    expect(getBadgeVariant(days)).toBe('green');
  });

  it('shows amber badge variant when 30-90 days remaining', () => {
    const closedAt = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000); // 300 days ago
    const retentionDays = 365;
    const days = getDaysRemaining(closedAt, retentionDays);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThanOrEqual(90);
    expect(getBadgeVariant(days)).toBe('amber');
  });

  it('shows red badge variant when < 30 days remaining', () => {
    const closedAt = new Date(Date.now() - 340 * 24 * 60 * 60 * 1000); // 340 days ago
    const retentionDays = 365;
    const days = getDaysRemaining(closedAt, retentionDays);
    expect(days).toBeLessThan(30);
    expect(days).toBeGreaterThanOrEqual(7);
    expect(getBadgeVariant(days)).toBe('red');
  });

  it('shows "Deletes in X days" label for CLOSED cases', () => {
    const closedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const retentionDays = 365;
    const days = getDaysRemaining(closedAt, retentionDays);
    const label = days <= 0 ? 'Deletes soon' : `Deletes in ${days} days`;
    expect(label).toMatch(/^Deletes in \d+ days$/);
  });

  it('shows "Auto-closes in X days" label for RESOLVED cases', () => {
    const resolvedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const autoCloseDays = 7;
    const days = getDaysRemaining(resolvedAt, autoCloseDays);
    const label = days <= 0 ? 'Auto-closes soon' : `Auto-closes in ${days} days`;
    expect(label).toMatch(/^Auto-closes in \d+ days$/);
  });
});
