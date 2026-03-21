import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE = readFileSync(
  join(process.cwd(), 'src/components/shared/route-announcer.tsx'),
  'utf-8'
);

describe('RouteAnnouncer', () => {
  it('renders with role="status" (implicit aria-live="polite")', () => {
    expect(SOURCE).not.toContain('aria-live="assertive"');
    expect(SOURCE).toContain('role="status"');
  });

  it('is visually hidden (sr-only)', () => {
    expect(SOURCE).toContain('sr-only');
  });

  it('updates announcement text when pathname changes', () => {
    expect(SOURCE).toContain('usePathname');
    expect(SOURCE).toContain('setAnnouncement');
  });
});
