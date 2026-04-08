/**
 * QuickBooks OAuth helpers — G10.3
 * Standalone functions for QuickBooks token exchange and refresh.
 * Used by QuickBooksAdapter (quickbooks-adapter.ts).
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { TokenResult } from './types';

export async function qbGetAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
  const authUrl = await getPlatformSetting<string>(
    'accounting.quickbooks.authUrl',
    'https://appcenter.intuit.com/connect/oauth2',
  );
  const clientId = await getPlatformSetting<string>('accounting.quickbooks.clientId', '');
  const scopes = await getPlatformSetting<string>(
    'accounting.quickbooks.scopes',
    'com.intuit.quickbooks.accounting',
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

export async function qbExchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
  const tokenUrl = await getPlatformSetting<string>(
    'accounting.quickbooks.tokenUrl',
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  );
  const clientId = await getPlatformSetting<string>('accounting.quickbooks.clientId', '');
  const clientSecret = await getPlatformSetting<string>('accounting.quickbooks.clientSecret', '');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QuickBooks token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    realmId?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
    realmId: data.realmId,
  };
}

export async function qbRefreshTokens(refreshToken: string): Promise<TokenResult> {
  const tokenUrl = await getPlatformSetting<string>(
    'accounting.quickbooks.tokenUrl',
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  );
  const clientId = await getPlatformSetting<string>('accounting.quickbooks.clientId', '');
  const clientSecret = await getPlatformSetting<string>('accounting.quickbooks.clientSecret', '');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QuickBooks token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    realmId?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
    realmId: data.realmId,
  };
}
