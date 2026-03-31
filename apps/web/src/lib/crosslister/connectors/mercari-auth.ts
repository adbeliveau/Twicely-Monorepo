/**
 * Mercari authentication helpers — extracted from mercari-connector.ts
 * to keep each file under 300 lines.
 *
 * Handles: config loading, authenticate, refreshAuth, revokeAuth, buildAuthUrl.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import type { CrosslisterAccount } from '../db-types';
import type {
  ConnectorCapabilities,
  AuthInput,
  AuthResult,
} from '../types';
import type { MercariTokenResponse, MercariUserProfile } from '@twicely/crosslister/connectors/mercari-types';

const MERCARI_AUTH_URL = 'https://www.mercari.com/oauth/authorize';
const MERCARI_TOKEN_URL = 'https://api.mercari.com/oauth/token';

export const MERCARI_API_BASE = 'https://api.mercari.com/v1';

interface MercariConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadMercariConfig(): Promise<MercariConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.mercari.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.mercari.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.mercari.redirectUri') ??
        'https://twicely.co/api/crosslister/mercari/callback',
    ),
  };
}

export async function mercariBuildAuthUrl(state: string): Promise<string> {
  const config = await loadMercariConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  });
  return `${MERCARI_AUTH_URL}?${params.toString()}`;
}

export async function mercariAuthenticate(
  credentials: AuthInput,
  capabilities: ConnectorCapabilities,
): Promise<AuthResult> {
  if (credentials.method !== 'OAUTH') {
    return {
      success: false,
      externalAccountId: null,
      externalUsername: null,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Mercari connector only supports OAUTH auth method',
    };
  }

  const config = await loadMercariConfig();

  try {
    const response = await fetch(MERCARI_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: credentials.code,
        redirect_uri: credentials.redirectUri ?? config.redirectUri,
      }).toString(),
    });

    const data: MercariTokenResponse = await response.json() as MercariTokenResponse;

    if (!response.ok || data.error) {
      logger.error('[MercariConnector.authenticate] Token exchange failed', {
        status: response.status,
        error: data.error,
        description: data.error_description,
      });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities,
        error: data.error_description ?? 'OAuth token exchange failed',
      };
    }

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    let externalAccountId: string | null = null;
    let externalUsername: string | null = null;
    try {
      const profileResponse = await fetch(`${MERCARI_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (profileResponse.ok) {
        const profile: MercariUserProfile = await profileResponse.json() as MercariUserProfile;
        externalAccountId = profile.id;
        externalUsername = profile.name;
      }
    } catch (profileErr) {
      logger.warn('[MercariConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
    }

    return {
      success: true,
      externalAccountId,
      externalUsername,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      sessionData: null,
      tokenExpiresAt,
      capabilities,
    };
  } catch (err) {
    logger.error('[MercariConnector.authenticate] Network error', { error: String(err) });
    return {
      success: false,
      externalAccountId: null,
      externalUsername: null,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Network error during authentication',
    };
  }
}

export async function mercariRefreshAuth(
  account: CrosslisterAccount,
  capabilities: ConnectorCapabilities,
): Promise<AuthResult> {
  if (!account.refreshToken) {
    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'No refresh token available',
    };
  }

  const config = await loadMercariConfig();

  try {
    const response = await fetch(MERCARI_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: account.refreshToken,
      }).toString(),
    });

    const data: MercariTokenResponse = await response.json() as MercariTokenResponse;

    if (!response.ok || data.error) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities,
        error: data.error_description ?? 'Token refresh failed',
      };
    }

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      success: true,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? account.refreshToken,
      sessionData: null,
      tokenExpiresAt,
      capabilities,
    };
  } catch (err) {
    logger.error('[MercariConnector.refreshAuth] Network error', { error: String(err) });
    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Network error during token refresh',
    };
  }
}

export function mercariRevokeAuth(): void {
  logger.info('[MercariConnector.revokeAuth] Account revoked (no revoke endpoint available)');
}
