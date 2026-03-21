import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const cwd = process.cwd();

function read(rel: string) {
  return readFileSync(join(cwd, rel), 'utf-8');
}

describe('Accessibility audit - static checks', () => {
  it('globals.css contains prefers-reduced-motion media query', () => {
    const css = read('src/app/globals.css');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('animation-duration: 0.01ms');
  });

  it('marketplace layout contains skip-nav import', () => {
    const src = read('src/app/(marketplace)/layout.tsx');
    expect(src).toContain('skip-nav');
    expect(src).toContain('SkipNav');
  });

  it('hub my layout contains skip-nav import', () => {
    const src = read('src/app/(hub)/my/layout.tsx');
    expect(src).toContain('skip-nav');
    expect(src).toContain('SkipNav');
  });

  it('hub admin layout contains skip-nav import', () => {
    const src = read('src/app/(hub)/layout.tsx');
    expect(src).toContain('skip-nav');
    expect(src).toContain('SkipNav');
  });

  it('checkout layout contains skip-nav import', () => {
    const src = read('src/app/(checkout)/layout.tsx');
    expect(src).toContain('skip-nav');
    expect(src).toContain('SkipNav');
  });

  it('auth layout contains skip-nav import', () => {
    const src = read('src/app/auth/layout.tsx');
    expect(src).toContain('skip-nav');
    expect(src).toContain('SkipNav');
  });

  it('storefront layout contains skip-nav import', () => {
    const src = read('src/app/(storefront)/st/[slug]/layout.tsx');
    expect(src).toContain('skip-nav');
    expect(src).toContain('SkipNav');
  });

  it('all layout main elements have id="main-content"', () => {
    const layouts = [
      'src/app/(marketplace)/layout.tsx',
      'src/app/(hub)/my/layout.tsx',
      'src/app/(hub)/layout.tsx',
      'src/app/(checkout)/layout.tsx',
      'src/app/(storefront)/st/[slug]/layout.tsx',
    ];
    for (const rel of layouts) {
      const src = read(rel);
      expect(src, `${rel} should have id="main-content"`).toContain('id="main-content"');
    }
  });

  it('accessibility.enforceMinContrast platform setting is seeded', () => {
    const src = read('src/lib/db/seed/v32-platform-settings-extended.ts');
    expect(src).toContain('accessibility.enforceMinContrast');
    expect(src).toContain("category: 'accessibility'");
  });
});
