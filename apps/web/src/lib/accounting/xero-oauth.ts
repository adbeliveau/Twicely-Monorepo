/**
 * Xero OAuth helpers — G10.3
 * Standalone functions for Xero token exchange and refresh.
 * Used by XeroAdapter (xero-adapter.ts).
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { TokenResult } from './types';

export async function xeroGetAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
  const authUrl = await getPlatformSetting<string>(
    'accounting.xero.authUrl',
    'https://login.xero.com/identity/connect/authorize',
  );
  const clientId = await getPlatformSetting<string>('accounting.xero.clientId', '');
  const scopes = await getPlatformSetting<string>(
    'accounting.xero.scopes',
    'openid profile email accounting.transactions',
  );

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  return `${authUrl}?${params.toString()}`;
}

export async function xeroExchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
  const tokenUrl = await getPlatformSetting<string>(
    'accounting.xero.tokenUrl',
    'https://identity.xero.com/connect/token',
  );
  const clientId = await getPlatformSetting<string>('accounting.xero.clientId', '');
  const clientSecret = await getPlatformSetting<string>('accounting.xero.clientSecret', '');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Xero token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // After token exchange, fetch tenants to get tenantId
  const tenantId = await xeroGetFirstTenantId(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
    tenantId,
  };
}

export async function xeroRefreshTokens(refreshToken: string): Promise<TokenResult> {
  const tokenUrl = await getPlatformSetting<string>(
    'accounting.xero.tokenUrl',
    'https://identity.xero.com/connect/token',
  );
  const clientId = await getPlatformSetting<string>('accounting.xero.clientId', '');
  const clientSecret = await getPlatformSetting<string>('accounting.xero.clientSecret', '');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Xero token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  };
}

export async function xeroGetFirstTenantId(accessToken: string): Promise<string | undefined> {
  const response = await fetch('https://api.xero.com/connections', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) return undefined;

  const tenants = await response.json() as Array<{ tenantId: string }>;
  return tenants[0]?.tenantId;
}
