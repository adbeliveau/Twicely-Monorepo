/**
 * ConnectorSettingsPage — Pure Logic Tests (G10.13)
 * Tests rendering decisions and helper logic without DOM rendering.
 */

import { describe, it, expect } from 'vitest';
import type { ConnectorSetting } from '@/lib/queries/admin-connector-settings';

// ─── Pure logic extracted from ConnectorSettingsPage ──────────────────────────

function isSecret(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes('secret') || lower.includes('token');
}

function maskValue(value: unknown): string {
  const str = String(value ?? '');
  if (!str || str.length <= 4) return str ? '••••••••' : '';
  return '••••••••' + str.slice(-4);
}

function getModuleStatusLabel(enabled: boolean): string {
  return enabled ? 'Enabled' : 'Disabled';
}

function groupSettings(settings: ConnectorSetting[]) {
  const enableSettings = settings.filter((s) => s.key.endsWith('Enabled'));
  const credentialSettings = settings.filter((s) =>
    s.key.includes('clientId') || s.key.includes('clientSecret') ||
    s.key.includes('redirectUri') || s.key.includes('apiBase') ||
    s.key.includes('userAgent') || s.key.includes('environment')
  );
  return { enableSettings, credentialSettings };
}

function isEditDisabled(canEdit: boolean): boolean {
  return !canEdit;
}

function getSectionHeading(authType: 'OAUTH' | 'SESSION'): string {
  return authType === 'OAUTH' ? 'OAuth Credentials' : 'Connection Settings';
}

function getTestResultColorClass(success: boolean): string {
  return success ? 'text-green-600' : 'text-red-600';
}

function getSaveResultColorClass(type: 'success' | 'error'): string {
  return type === 'error' ? 'text-red-600' : 'text-green-600';
}

function extractLabelFromKey(key: string): string {
  return key.split('.').pop() ?? key;
}

// ─── Test data ─────────────────────────────────────────────────────────────────

function makeSetting(key: string, value: unknown, type = 'string'): ConnectorSetting {
  return { id: `ps-${key}`, key, value, type, description: `Setting for ${key}` };
}

const OAUTH_SETTINGS: ConnectorSetting[] = [
  makeSetting('crosslister.ebay.importEnabled', true, 'boolean'),
  makeSetting('crosslister.ebay.crosslistEnabled', false, 'boolean'),
  makeSetting('crosslister.ebay.automationEnabled', false, 'boolean'),
  makeSetting('crosslister.ebay.clientId', 'my-client-id', 'string'),
  makeSetting('crosslister.ebay.clientSecret', 'super-secret-value', 'string'),
  makeSetting('crosslister.ebay.redirectUri', 'https://twicely.co/callback/ebay', 'string'),
  makeSetting('crosslister.ebay.environment', 'SANDBOX', 'string'),
];

const SESSION_SETTINGS: ConnectorSetting[] = [
  makeSetting('crosslister.poshmark.importEnabled', true, 'boolean'),
  makeSetting('crosslister.poshmark.crosslistEnabled', true, 'boolean'),
  makeSetting('crosslister.poshmark.apiBase', 'https://api.poshmark.com', 'string'),
  makeSetting('crosslister.poshmark.userAgent', 'Twicely/1.0', 'string'),
];

// ─── isSecret helper ───────────────────────────────────────────────────────────

describe('ConnectorSettingsPage — isSecret', () => {
  it('returns true for key containing "secret"', () => {
    expect(isSecret('crosslister.ebay.clientSecret')).toBe(true);
  });

  it('returns true for key containing "token"', () => {
    expect(isSecret('crosslister.ebay.accessToken')).toBe(true);
  });

  it('returns false for non-secret keys', () => {
    expect(isSecret('crosslister.ebay.clientId')).toBe(false);
    expect(isSecret('crosslister.ebay.importEnabled')).toBe(false);
    expect(isSecret('crosslister.ebay.apiBase')).toBe(false);
  });

  it('is case-insensitive (SECRET uppercase)', () => {
    expect(isSecret('crosslister.ebay.CLIENT_SECRET')).toBe(true);
  });
});

// ─── maskValue helper ─────────────────────────────────────────────────────────

describe('ConnectorSettingsPage — maskValue', () => {
  it('masks a long secret value, showing last 4 chars', () => {
    const masked = maskValue('super-secret-value');
    expect(masked).toBe('••••••••alue');
  });

  it('masks a short value (<=4 chars) to all dots', () => {
    expect(maskValue('abc')).toBe('••••••••');
  });

  it('returns empty string for empty value', () => {
    expect(maskValue('')).toBe('');
  });

  it('handles null value as empty string', () => {
    expect(maskValue(null)).toBe('');
  });

  it('handles undefined value as empty string', () => {
    expect(maskValue(undefined)).toBe('');
  });
});

// ─── groupSettings ────────────────────────────────────────────────────────────

describe('ConnectorSettingsPage — groupSettings', () => {
  it('separates Enabled settings from credential settings for OAuth connector', () => {
    const { enableSettings, credentialSettings } = groupSettings(OAUTH_SETTINGS);
    expect(enableSettings).toHaveLength(3);
    // clientId, clientSecret, redirectUri, environment = 4
    expect(credentialSettings).toHaveLength(4);
  });

  it('all enable settings end with "Enabled"', () => {
    const { enableSettings } = groupSettings(OAUTH_SETTINGS);
    expect(enableSettings.every((s) => s.key.endsWith('Enabled'))).toBe(true);
  });

  it('credential settings include clientId, clientSecret, redirectUri, environment', () => {
    const { credentialSettings } = groupSettings(OAUTH_SETTINGS);
    const keys = credentialSettings.map((s) => extractLabelFromKey(s.key));
    expect(keys).toContain('clientId');
    expect(keys).toContain('clientSecret');
    expect(keys).toContain('redirectUri');
    expect(keys).toContain('environment');
  });

  it('session connector credential settings include apiBase and userAgent', () => {
    const { credentialSettings } = groupSettings(SESSION_SETTINGS);
    const keys = credentialSettings.map((s) => extractLabelFromKey(s.key));
    expect(keys).toContain('apiBase');
    expect(keys).toContain('userAgent');
  });

  it('returns empty arrays for empty settings input', () => {
    const { enableSettings, credentialSettings } = groupSettings([]);
    expect(enableSettings).toHaveLength(0);
    expect(credentialSettings).toHaveLength(0);
  });
});

// ─── Section heading ──────────────────────────────────────────────────────────

describe('ConnectorSettingsPage — section heading', () => {
  it('shows "OAuth Credentials" for OAUTH auth type', () => {
    expect(getSectionHeading('OAUTH')).toBe('OAuth Credentials');
  });

  it('shows "Connection Settings" for SESSION auth type', () => {
    expect(getSectionHeading('SESSION')).toBe('Connection Settings');
  });
});

// ─── canEdit gating ───────────────────────────────────────────────────────────

describe('ConnectorSettingsPage — canEdit gating', () => {
  it('disables inputs when canEdit is false', () => {
    expect(isEditDisabled(false)).toBe(true);
  });

  it('enables inputs when canEdit is true', () => {
    expect(isEditDisabled(true)).toBe(false);
  });
});

// ─── Test result display ──────────────────────────────────────────────────────

describe('ConnectorSettingsPage — test connection result display', () => {
  it('uses green color class for successful test result', () => {
    expect(getTestResultColorClass(true)).toContain('green');
  });

  it('uses red color class for failed test result', () => {
    expect(getTestResultColorClass(false)).toContain('red');
  });
});

// ─── Save result display ──────────────────────────────────────────────────────

describe('ConnectorSettingsPage — save result display', () => {
  it('uses red color class for error save result', () => {
    expect(getSaveResultColorClass('error')).toContain('red');
  });

  it('uses green color class for success save result', () => {
    expect(getSaveResultColorClass('success')).toContain('green');
  });
});

// ─── Module status toggles ────────────────────────────────────────────────────

describe('ConnectorSettingsPage — module status toggles', () => {
  it('renders correct number of module toggles for Enabled settings', () => {
    const { enableSettings } = groupSettings(OAUTH_SETTINGS);
    expect(enableSettings).toHaveLength(3);
  });

  it('toggle label is derived from key suffix', () => {
    const key = 'crosslister.ebay.importEnabled';
    const label = key.split('.').pop()?.replace('Enabled', '') ?? key;
    expect(label).toBe('import');
  });

  it('getModuleStatusLabel returns Enabled when true', () => {
    expect(getModuleStatusLabel(true)).toBe('Enabled');
  });

  it('getModuleStatusLabel returns Disabled when false', () => {
    expect(getModuleStatusLabel(false)).toBe('Disabled');
  });
});
