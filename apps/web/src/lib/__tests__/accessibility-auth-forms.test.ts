/**
 * G7 Accessibility — Auth Form Static Checks
 * Verifies WCAG 2.1 AA compliance patterns in auth form source files.
 * Uses static source analysis (readFileSync) matching established project patterns.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const cwd = process.cwd();

function read(rel: string) {
  return readFileSync(join(cwd, rel), 'utf-8');
}

describe('Auth form accessibility — login page', () => {
  const SRC = read('src/app/auth/login/page.tsx');

  it('error div has role="alert"', () => {
    expect(SRC).toContain('role="alert"');
  });

  it('error div has aria-live="assertive"', () => {
    expect(SRC).toContain('aria-live="assertive"');
  });

  it('error div has a stable id for aria-describedby', () => {
    expect(SRC).toContain('id="login-error"');
  });

  it('form uses aria-describedby referencing the error element', () => {
    expect(SRC).toContain('aria-describedby');
    expect(SRC).toContain('login-error');
  });

  it('inputs use focus-visible instead of focus for ring styles', () => {
    expect(SRC).toContain('focus-visible:ring-2');
    // Must NOT use plain focus:ring (WCAG 2.4.7 — only keyboard-visible focus)
    expect(SRC).not.toMatch(/(?<![a-z-])focus:ring(?!-visible)/);
  });

  it('email input has associated label via htmlFor', () => {
    expect(SRC).toContain('htmlFor="email"');
    expect(SRC).toContain('id="email"');
  });

  it('password input has associated label via htmlFor', () => {
    expect(SRC).toContain('htmlFor="password"');
    expect(SRC).toContain('id="password"');
  });
});

describe('Auth form accessibility — signup page', () => {
  const SRC = read('src/app/auth/signup/signup-form.tsx');

  it('error div has role="alert"', () => {
    expect(SRC).toContain('role="alert"');
  });

  it('error div has aria-live="assertive"', () => {
    expect(SRC).toContain('aria-live="assertive"');
  });

  it('error div has stable id "signup-error"', () => {
    expect(SRC).toContain('id="signup-error"');
  });

  it('form uses aria-describedby referencing the error element', () => {
    expect(SRC).toContain('aria-describedby');
    expect(SRC).toContain('signup-error');
  });

  it('text/password inputs use focus-visible ring (WCAG 2.4.7)', () => {
    // Text inputs must use focus-visible:ring-2 (not focus:ring) so only keyboard
    // users see the ring — focus:ring-ring on checkbox is acceptable.
    expect(SRC).toContain('focus-visible:ring-2');
    expect(SRC).toContain('focus-visible:outline-none');
  });

  it('password field has aria-describedby linking to hint', () => {
    expect(SRC).toContain('aria-describedby="password-hint"');
    expect(SRC).toContain('id="password-hint"');
  });

  it('all inputs have associated labels', () => {
    expect(SRC).toContain('htmlFor="name"');
    expect(SRC).toContain('htmlFor="email"');
    expect(SRC).toContain('htmlFor="password"');
    expect(SRC).toContain('htmlFor="confirmPassword"');
    expect(SRC).toContain('htmlFor="terms"');
  });
});

describe('Auth form accessibility — forgot password page', () => {
  const SRC = read('src/app/auth/forgot-password/page.tsx');

  it('error div has role="alert"', () => {
    expect(SRC).toContain('role="alert"');
  });

  it('error div has aria-live="assertive"', () => {
    expect(SRC).toContain('aria-live="assertive"');
  });

  it('error element has stable id "forgot-error"', () => {
    expect(SRC).toContain('id="forgot-error"');
  });

  it('email input has associated label', () => {
    expect(SRC).toContain('htmlFor="email"');
    expect(SRC).toContain('id="email"');
  });

  it('inputs use focus-visible ring', () => {
    expect(SRC).toContain('focus-visible:ring-2');
  });
});

describe('Auth form accessibility — reset password page', () => {
  const SRC = read('src/app/auth/reset-password/page.tsx');

  it('error div has role="alert"', () => {
    expect(SRC).toContain('role="alert"');
  });

  it('error div has aria-live="assertive"', () => {
    expect(SRC).toContain('aria-live="assertive"');
  });

  it('error element has stable id "reset-error"', () => {
    expect(SRC).toContain('id="reset-error"');
  });

  it('password and confirm inputs have associated labels', () => {
    expect(SRC).toContain('htmlFor="password"');
    expect(SRC).toContain('htmlFor="confirmPassword"');
  });

  it('inputs use focus-visible ring', () => {
    expect(SRC).toContain('focus-visible:ring-2');
  });
});
