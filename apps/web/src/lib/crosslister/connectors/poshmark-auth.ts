/**
 * Poshmark authentication helpers — extracted from poshmark-connector.ts
 * to keep each file under 300 lines.
 *
 * Handles: config loading, session extraction, authenticate, refreshAuth, revokeAuth.
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
import type {
  PoshmarkAuthResponse,
  PoshmarkSessionData,
} from '@twicely/crosslister/connectors/poshmark-types';

export interface PoshmarkConfig {
  apiBase: string;
  userAgent: string;
}

export async function loadPoshmarkConfig(): Promise<PoshmarkConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    apiBase: String(settingsMap.get('crosslister.poshmark.apiBase') ?? 'https://poshmark.com/api'),
    userAgent: String(
      settingsMap.get('crosslister.poshmark.userAgent') ??
        'Poshmark/8.0 (iPhone; iOS 17.0)',
    ),
  };
}

export function extractSessionData(account: CrosslisterAccount): PoshmarkSessionData | null {
  if (!account.sessionData) return null;
  const sd = account.sessionData as Record<string, unknown>;
  if (typeof sd['jwt'] !== 'string' || typeof sd['username'] !== 'string') return null;
  return { jwt: sd['jwt'], username: sd['username'] };
}

export async function poshmarkAuthenticate(
  credentials: AuthInput,
  capabilities: ConnectorCapabilities,
): Promise<AuthResult> {
  if (credentials.method !== 'SESSION') {
    return {
      success: false,
      externalAccountId: null,
      externalUsername: null,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Poshmark connector only supports SESSION auth method',
    };
  }

  const config = await loadPoshmarkConfig();

  try {
    const response = await fetch(`${config.apiBase}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': config.userAgent,
      },
      body: JSON.stringify({
        username_or_email: credentials.username,
        password: credentials.password,
      }),
    });

    const data: PoshmarkAuthResponse = await response.json() as PoshmarkAuthResponse;

    if (!response.ok || !data.jwt || !data.user) {
      logger.error('[PoshmarkConnector.authenticate] Login failed', {
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
        error: data.error ?? 'Invalid credentials',
      };
    }

    const sessionData: PoshmarkSessionData = {
      jwt: data.jwt,
      username: data.user.username,
    };

    return {
      success: true,
      externalAccountId: data.user.id,
      externalUsername: data.user.username,
      accessToken: null,
      refreshToken: null,
      sessionData,
      tokenExpiresAt: null,
      capabilities,
    };
  } catch (err) {
    logger.error('[PoshmarkConnector.authenticate] Network error', { error: String(err) });
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

export async function poshmarkRefreshAuth(
  account: CrosslisterAccount,
  capabilities: ConnectorCapabilities,
): Promise<AuthResult> {
  const sd = extractSessionData(account);
  if (!sd?.jwt) {
    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Session expired. Please reconnect.',
    };
  }

  const config = await loadPoshmarkConfig();

  try {
    const response = await fetch(
      `${config.apiBase}/posts?username=${encodeURIComponent(sd.username)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${sd.jwt}`,
          'User-Agent': config.userAgent,
        },
      },
    );

    if (response.ok) {
      return {
        success: true,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: account.sessionData as Record<string, unknown> | null,
        tokenExpiresAt: null,
        capabilities,
      };
    }

    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Session expired. Please reconnect.',
    };
  } catch (err) {
    logger.error('[PoshmarkConnector.refreshAuth] Network error', { error: String(err) });
    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'Session expired. Please reconnect.',
    };
  }
}

export async function poshmarkRevokeAuth(account: CrosslisterAccount): Promise<void> {
  const sd = extractSessionData(account);
  if (!sd?.jwt) return;

  const config = await loadPoshmarkConfig();
  try {
    await fetch(`${config.apiBase}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sd.jwt}`,
        'User-Agent': config.userAgent,
      },
    });
  } catch (err) {
    logger.warn('[PoshmarkConnector.revokeAuth] Logout failed (best effort)', { error: String(err) });
  }
}
