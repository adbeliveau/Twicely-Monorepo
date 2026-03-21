import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockJoin = vi.fn((...parts: string[]) => parts.join('/'));
vi.mock('path', () => ({
  join: (...args: string[]) => mockJoin(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePackageJson(
  dependencies: Record<string, string> = {},
  devDependencies: Record<string, string> = {}
): string {
  return JSON.stringify({ dependencies, devDependencies });
}

// ─── getInstalledDependencies ─────────────────────────────────────────────────

describe('getInstalledDependencies', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all tracked dependencies with versions from package.json', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({
      next: '16.1.6',
      react: '19.2.3',
      typescript: '5.8.3',
      'drizzle-orm': '0.45.1',
      postgres: '3.4.8',
      stripe: '18.2.0',
      shippo: '2.0.0',
      typesense: '1.8.2',
      'better-auth': '1.4.18',
      '@casl/ability': '6.8.0',
      resend: '4.6.0',
      '@react-email/components': '1.0.7',
      tailwindcss: '4.1.5',
      bullmq: '5.69.3',
      zod: '3.24.4',
    }, {
      vitest: '3.1.1',
      '@playwright/test': '1.50.1',
      '@anthropic-ai/sdk': '0.78.0',
    }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    expect(result.length).toBeGreaterThan(0);

    const nextDep = result.find((d) => d.name === 'next');
    expect(nextDep).toBeDefined();
    expect(nextDep!.currentVersion).toBe('16.1.6');
    expect(nextDep!.category).toBe('framework');
  });

  it('strips semver caret prefix from version strings', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({
      next: '^16.1.6',
      react: '^19.2.3',
    }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const nextDep = result.find((d) => d.name === 'next');
    expect(nextDep!.currentVersion).toBe('16.1.6');

    const reactDep = result.find((d) => d.name === 'react');
    expect(reactDep!.currentVersion).toBe('19.2.3');
  });

  it('strips semver tilde prefix from version strings', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({
      next: '~16.1.6',
    }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const nextDep = result.find((d) => d.name === 'next');
    expect(nextDep!.currentVersion).toBe('16.1.6');
  });

  it('strips >= prefix from version strings', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({
      next: '>=16.0.0',
    }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const nextDep = result.find((d) => d.name === 'next');
    expect(nextDep!.currentVersion).toBe('16.0.0');
  });

  it('returns "not installed" for packages not in package.json', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({
      next: '16.1.6',
    }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const missingDep = result.find((d) => d.name === 'stripe');
    expect(missingDep!.currentVersion).toBe('not installed');
  });

  it('returns empty array when package.json read fails', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    expect(result).toEqual([]);
  });

  it('returns empty array when package.json contains invalid JSON', async () => {
    mockReadFile.mockResolvedValue('{ invalid json ');

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    expect(result).toEqual([]);
  });

  it('merges dependencies and devDependencies — devDep version returned', async () => {
    mockReadFile.mockResolvedValue(makePackageJson(
      { react: '19.2.3' },
      { vitest: '^3.1.1' }
    ));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const vitestDep = result.find((d) => d.name === 'vitest');
    expect(vitestDep).toBeDefined();
    expect(vitestDep!.currentVersion).toBe('3.1.1');
    expect(vitestDep!.category).toBe('testing');
  });

  it('categorizes @casl/ability as auth', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({ '@casl/ability': '^6.8.0' }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const caslDep = result.find((d) => d.name === '@casl/ability');
    expect(caslDep!.category).toBe('auth');
  });

  it('categorizes @anthropic-ai/sdk as crosslister', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({}, { '@anthropic-ai/sdk': '^0.78.0' }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    const aiDep = result.find((d) => d.name === '@anthropic-ai/sdk');
    expect(aiDep!.category).toBe('crosslister');
  });

  it('returns 18 tracked dependencies total', async () => {
    mockReadFile.mockResolvedValue(makePackageJson({
      next: '16.1.6',
      react: '19.2.3',
      typescript: '5.8.3',
      'drizzle-orm': '0.45.1',
      postgres: '3.4.8',
      stripe: '18.2.0',
      shippo: '2.0.0',
      typesense: '1.8.2',
      'better-auth': '1.4.18',
      '@casl/ability': '6.8.0',
      resend: '4.6.0',
      '@react-email/components': '1.0.7',
      tailwindcss: '4.1.5',
      bullmq: '5.69.3',
      zod: '3.24.4',
    }, {
      vitest: '3.1.1',
      '@playwright/test': '1.50.1',
      '@anthropic-ai/sdk': '0.78.0',
    }));

    const { getInstalledDependencies } = await import('../admin-dependency-status');
    const result = await getInstalledDependencies();

    // 18 entries as defined in TRACKED_DEPENDENCIES
    expect(result.length).toBe(18);
  });
});
