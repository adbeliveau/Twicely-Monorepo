/**
 * Shopify OAuth helpers — buildAuthUrl, authenticate, refreshAuth, revokeAuth.
 * Extracted from ShopifyConnector to keep connector.ts under the 300-line limit.
 * Source: H3.3 install prompt §8.3
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

import { logger } from '@twicely/logger';
import type { AuthInput, AuthResult, ConnectorCapabilities } from '../types';
import type { CrosslisterAccount } from '../db-types';
import type { ShopifyAccessTokenResponse, ShopifyShopResponse } from '@twicely/crosslister/connectors/shopify-types';
import { ShopifyAccessTokenSchema, ShopifyShopSchema } from '@twicely/crosslister/connectors/shopify-schemas';

interface ShopifyAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  apiVersion: string;
}

/**
 * Build the Shopify per-store OAuth authorization URL.
 * Shopify requires the shop domain in the auth URL.
 */
export function buildShopifyAuthUrl(
  config: ShopifyAuthConfig,
  state: string,
  shopDomain: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes,
    redirect_uri: config.redirectUri,
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Authenticate via Shopify OAuth — exchange code for permanent access token.
 */
export async function authenticateShopify(
  config: ShopifyAuthConfig,
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
      error: 'ShopifyConnector only supports OAUTH auth method',
    };
  }

  const shopDomain = credentials.state ?? '';

  if (!shopDomain) {
    return {
      success: false,
      externalAccountId: null,
      externalUsername: null,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'ShopifyConnector.authenticate: shopDomain missing from credentials.state',
    };
  }

  const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: credentials.code,
      }),
    });

    const rawData = await response.json() as ShopifyAccessTokenResponse;

    if (!response.ok || rawData.error) {
      logger.error('[ShopifyConnector.authenticate] Token exchange failed', {
        status: response.status,
        error: rawData.error,
        description: rawData.error_description,
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
        error: rawData.error_description ?? 'OAuth token exchange failed',
      };
    }

    const tokenParsed = ShopifyAccessTokenSchema.safeParse(rawData);
    if (!tokenParsed.success) {
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities,
        error: 'Invalid token response from Shopify',
      };
    }

    const accessToken = tokenParsed.data.access_token;

    // Fetch shop info to populate externalAccountId and externalUsername
    let externalAccountId: string | null = null;
    let externalUsername: string | null = null;
    try {
      const shopUrl = `https://${shopDomain}/admin/api/${config.apiVersion}/shop.json`;
      const shopResponse = await fetch(shopUrl, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });
      if (shopResponse.ok) {
        const shopData = await shopResponse.json() as ShopifyShopResponse;
        const shopParsed = ShopifyShopSchema.safeParse(shopData.shop);
        if (shopParsed.success) {
          externalAccountId = shopParsed.data.myshopify_domain;
          externalUsername = shopParsed.data.name;
        }
      }
    } catch (shopErr) {
      logger.warn('[ShopifyConnector.authenticate] Failed to fetch shop info', { error: String(shopErr) });
    }

    return {
      success: true,
      externalAccountId,
      externalUsername,
      accessToken,
      refreshToken: null,       // Shopify tokens are permanent — no refresh token
      sessionData: null,
      tokenExpiresAt: null,     // Permanent token — no expiry
      capabilities,
    };
  } catch (err) {
    logger.error('[ShopifyConnector.authenticate] Network error', { error: String(err) });
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

/**
 * Refresh Shopify auth — tokens are permanent, no refresh needed.
 */
export function refreshShopifyAuth(
  account: CrosslisterAccount,
  capabilities: ConnectorCapabilities,
): AuthResult {
  if (!account.accessToken) {
    return {
      success: false,
      externalAccountId: account.externalAccountId,
      externalUsername: account.externalUsername,
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      tokenExpiresAt: null,
      capabilities,
      error: 'No access token available',
    };
  }
  return {
    success: true,
    externalAccountId: account.externalAccountId,
    externalUsername: account.externalUsername,
    accessToken: account.accessToken,
    refreshToken: null,
    sessionData: null,
    tokenExpiresAt: null,
    capabilities,
  };
}

/**
 * Revoke Shopify OAuth — best-effort DELETE on the API permissions endpoint.
 */
export async function revokeShopifyAuth(account: CrosslisterAccount): Promise<void> {
  if (!account.accessToken || !account.externalAccountId) {
    logger.info('[ShopifyConnector.revokeAuth] No token or shop domain — nothing to revoke');
    return;
  }
  const shopDomain = account.externalAccountId;
  try {
    await fetch(`https://${shopDomain}/admin/api_permissions/current.json`, {
      method: 'DELETE',
      headers: { 'X-Shopify-Access-Token': account.accessToken },
    });
    logger.info('[ShopifyConnector.revokeAuth] Revoke request sent', { shopDomain });
  } catch (err) {
    logger.warn('[ShopifyConnector.revokeAuth] Revoke request failed (best-effort)', {
      shopDomain,
      error: String(err),
    });
  }
}
