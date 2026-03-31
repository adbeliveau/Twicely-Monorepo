/**
 * Depop authentication helpers — extracted from depop-connector.ts
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
import type { DepopTokenResponse, DepopUserProfile } from './depop-types';

const DEPOP_AUTH_URL = 'https://www.depop.com/oauth/authorize';
const DEPOP_TOKEN_URL = 'https://www.depop.com/oauth/token';

export const DEPOP_API_BASE = 'https://api.depop.com/api/v2';

interface DepopConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadDepopConfig(): Promise<DepopConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.depop.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.depop.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.depop.redirectUri') ??
        'https://twicely.co/api/crosslister/depop/callback',
    ),
  };
}

export async function depopBuildAuthUrl(state: string): Promise<string> {
  const config = await loadDepopConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  });
  return `${DEPOP_AUTH_URL}?${params.toString()}`;
}

export async function depopAuthenticate(
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
      error: 'Depop connector only supports OAUTH auth method',
    };
  }

  const config = await loadDepopConfig();

  try {
    const response = await fetch(DEPOP_TOKEN_URL, {
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

    const data: DepopTokenResponse = await response.json() as DepopTokenResponse;

    if (!response.ok || data.error) {
      logger.error('[DepopConnector.authenticate] Token exchange failed', {
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
      const profileResponse = await fetch(`${DEPOP_API_BASE}/auth/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (profileResponse.ok) {
        const profile: DepopUserProfile = await profileResponse.json() as DepopUserProfile;
        externalAccountId = profile.id;
        externalUsername = profile.username;
      }
    } catch (profileErr) {
      logger.warn('[DepopConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
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
    logger.error('[DepopConnector.authenticate] Network error', { error: String(err) });
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

export async function depopRefreshAuth(
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

  const config = await loadDepopConfig();

  try {
    const response = await fetch(DEPOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: account.refreshToken,
      }).toString(),
    });

    const data: DepopTokenResponse = await response.json() as DepopTokenResponse;

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
    logger.error('[DepopConnector.refreshAuth] Network error', { error: String(err) });
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

export function depopRevokeAuth(): void {
  logger.info('[DepopConnector.revokeAuth] Account revoked (no revoke endpoint available)');
}
