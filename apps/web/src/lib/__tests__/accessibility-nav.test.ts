/**
 * G7 Accessibility — Navigation Static Checks
 * Verifies WCAG 2.1 AA compliance in navigation components.
 * Checks: unique aria-labels, aria-expanded on collapsibles,
 * aria-current="page" on active links, aria-hidden on decorative icons.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const cwd = process.cwd();

function read(rel: string) {
  return readFileSync(join(cwd, rel), 'utf-8');
}

describe('Marketplace header navigation accessibility', () => {
  const SRC = read('src/components/shared/marketplace-header.tsx');

  it('main nav has aria-label="Main navigation"', () => {
    expect(SRC).toContain('aria-label="Main navigation"');
  });

  it('uses a <header> landmark element', () => {
    expect(SRC).toContain('<header');
  });
});

describe('Mobile bottom nav accessibility', () => {
  const SRC = read('src/components/shared/mobile-bottom-nav.tsx');

  it('nav has unique aria-label="Mobile navigation"', () => {
    expect(SRC).toContain('aria-label="Mobile navigation"');
  });

  it('nav icons have aria-hidden="true"', () => {
    expect(SRC).toContain('aria-hidden="true"');
  });

  it('active link sets aria-current="page"', () => {
    expect(SRC).toContain("aria-current={active ? 'page' : undefined}");
  });

  it('uses <nav> landmark element', () => {
    expect(SRC).toContain('<nav');
  });
});

describe('Admin sidebar navigation accessibility', () => {
  const SRC = read('src/components/admin/admin-sidebar.tsx');

  it('sidebar nav has unique aria-label="Admin navigation"', () => {
    expect(SRC).toContain('aria-label="Admin navigation"');
  });

  it('collapsible buttons have aria-expanded', () => {
    expect(SRC).toContain('aria-expanded={open}');
  });

  it('collapsible buttons have aria-controls referencing child list', () => {
    expect(SRC).toContain('aria-controls={listId}');
  });

  it('child list id is derived from item key (aria-controls target)', () => {
    expect(SRC).toContain('admin-nav-');
  });

  it('active nav links have aria-current="page"', () => {
    expect(SRC).toContain("aria-current={isActive ? 'page' : undefined}");
  });

  it('nav icons have aria-hidden="true"', () => {
    expect(SRC).toContain('aria-hidden="true"');
  });

  it('disabled nav items have aria-disabled="true"', () => {
    expect(SRC).toContain('aria-disabled="true"');
  });

  it('uses <aside> and <nav> landmarks', () => {
    expect(SRC).toContain('<aside');
    expect(SRC).toContain('<nav');
  });
});

describe('Hub sidebar navigation accessibility', () => {
  const SRC = read('src/components/hub/hub-sidebar.tsx');

  it('hub nav has unique aria-label="User hub navigation"', () => {
    expect(SRC).toContain('aria-label="User hub navigation"');
  });

  it('active links have aria-current="page"', () => {
    expect(SRC).toContain("aria-current={active ? 'page' : undefined}");
  });

  it('disabled nav items have aria-disabled="true"', () => {
    expect(SRC).toContain('aria-disabled="true"');
  });
});

describe('Hub bottom nav accessibility', () => {
  const SRC = read('src/components/hub/hub-bottom-nav.tsx');

  it('hub bottom nav has unique aria-label="Hub mobile navigation"', () => {
    expect(SRC).toContain('aria-label="Hub mobile navigation"');
  });

  it('active links have aria-current="page"', () => {
    expect(SRC).toContain("aria-current={active ? 'page' : undefined}");
  });

  it('icons have aria-hidden="true"', () => {
    expect(SRC).toContain('aria-hidden="true"');
  });
});

describe('Marketplace footer navigation accessibility', () => {
  const SRC = read('src/components/shared/marketplace-footer.tsx');

  it('footer has aria-label="Footer navigation" on its nav', () => {
    expect(SRC).toContain('aria-label="Footer navigation"');
  });

  it('uses <footer> with role="contentinfo"', () => {
    expect(SRC).toContain('role="contentinfo"');
  });
});

describe('Nav aria-label uniqueness — no duplicate aria-labels across nav components', () => {
  const components = [
    { path: 'src/components/shared/marketplace-header.tsx', label: 'Main navigation' },
    { path: 'src/components/shared/mobile-bottom-nav.tsx', label: 'Mobile navigation' },
    { path: 'src/components/admin/admin-sidebar.tsx', label: 'Admin navigation' },
    { path: 'src/components/hub/hub-sidebar.tsx', label: 'User hub navigation' },
    { path: 'src/components/hub/hub-bottom-nav.tsx', label: 'Hub mobile navigation' },
    { path: 'src/components/shared/marketplace-footer.tsx', label: 'Footer navigation' },
  ];

  it('each nav component has a distinct aria-label value', () => {
    const labels = components.map(({ path, label }) => {
      const src = read(path);
      return { path, label, present: src.includes(`aria-label="${label}"`) };
    });

    const missing = labels.filter((l) => !l.present);
    expect(missing, `Nav components missing expected aria-label: ${JSON.stringify(missing)}`).toHaveLength(0);

    // All labels must be unique (no two components share the same label)
    const labelValues = labels.map((l) => l.label);
    const unique = new Set(labelValues);
    expect(unique.size).toBe(labelValues.length);
  });
});
