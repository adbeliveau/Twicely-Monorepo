import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE = readFileSync(
  join(process.cwd(), 'src/components/shared/skip-nav.tsx'),
  'utf-8'
);

describe('SkipNav', () => {
  it('renders a link with href="#main-content"', () => {
    expect(SOURCE).toContain('href="#main-content"');
  });

  it('has text "Skip to main content"', () => {
    expect(SOURCE).toContain('Skip to main content');
  });

  it('has sr-only positioning classes by default', () => {
    expect(SOURCE).toContain('sr-only');
  });

  it('becomes visible on focus (has focus: override classes)', () => {
    expect(SOURCE).toContain('focus:not-sr-only');
  });
});
