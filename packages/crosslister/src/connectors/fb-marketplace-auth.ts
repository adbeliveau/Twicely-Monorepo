/**
 * Facebook Marketplace authentication helpers — extracted from fb-marketplace-connector.ts
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
import type { FbOAuthTokenResponse, FbUserProfile } from './fb-marketplace-types';

const FB_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';

export const FB_API_BASE = 'https://graph.facebook.com/v18.0';

const FB_SCOPES = ['commerce_account_manage_orders', 'catalog_management'].join(',');

interface FbMarketplaceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadFbMarketplaceConfig(): Promise<FbMarketplaceConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.fbMarketplace.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.fbMarketplace.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.fbMarketplace.redirectUri') ??
        'https://twicely.co/api/crosslister/fb-marketplace/callback',
    ),
  };
}

export async function fbMarketplaceBuildAuthUrl(state: string): Promise<string> {
  const config = await loadFbMarketplaceConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: FB_SCOPES,
    state,
  });
  return `${FB_AUTH_URL}?${params.toString()}`;
}

export async function fbMarketplaceAuthenticate(
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
      error: 'Facebook Marketplace connector only supports OAUTH auth method',
    };
  }

  const config = await loadFbMarketplaceConfig();

  try {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: credentials.redirectUri ?? config.redirectUri,
      code: credentials.code,
    });

    const response = await fetch(`${FB_TOKEN_URL}?${params.toString()}`, {
      method: 'GET',
    });

    const data: FbOAuthTokenResponse = await response.json() as FbOAuthTokenResponse;

    if (!response.ok || data.error) {
      logger.error('[FbMarketplaceConnector.authenticate] Token exchange failed', {
        status: response.status,
        error: data.error,
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
        error: data.error?.message ?? 'OAuth token exchange failed',
      };
    }

    const tokenExpiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    let externalAccountId: string | null = null;
    let externalUsername: string | null = null;
    try {
      const profileResponse = await fetch(`${FB_API_BASE}/me?fields=id,name`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (profileResponse.ok) {
        const profile: FbUserProfile = await profileResponse.json() as FbUserProfile;
        externalAccountId = profile.id;
        externalUsername = profile.name;
      }
    } catch (profileErr) {
      logger.warn('[FbMarketplaceConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
    }

    return {
      success: true,
      externalAccountId,
      externalUsername,
      accessToken: data.access_token,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt,
      capabilities,
    };
  } catch (err) {
    logger.error('[FbMarketplaceConnector.authenticate] Network error', { error: String(err) });
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

export function fbMarketplaceRefreshAuth(
  account: CrosslisterAccount,
  capabilities: ConnectorCapabilities,
): AuthResult {
  return {
    success: false,
    externalAccountId: account.externalAccountId,
    externalUsername: account.externalUsername,
    accessToken: null,
    refreshToken: null,
    sessionData: null,
    tokenExpiresAt: null,
    capabilities,
    error: 'Facebook tokens cannot be refreshed. Please reconnect.',
  };
}

export function fbMarketplaceRevokeAuth(): void {
  logger.info('[FbMarketplaceConnector.revokeAuth] Account revoked (no revoke endpoint used)');
}
