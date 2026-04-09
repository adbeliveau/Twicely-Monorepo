'use server';

/**
 * Crosslister account management server actions.
 * Source: F1.1 install prompt §2.3; F2 install prompt §2.0.4
 *
 * Actions: connectEbayAccount (deprecated), connectPlatformAccount,
 *          authenticateSessionAccount, disconnectAccount, refreshAccountAuth
 */

import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import '@twicely/crosslister/connectors'; // Ensure all connectors are registered
import { getConnector } from '@twicely/crosslister/connector-registry';
import { logger } from '@twicely/logger';
import { encryptSessionData } from '@twicely/crosslister/token-crypto';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { cookies } from 'next/headers';
import type { ExternalChannel } from '@twicely/crosslister/types';

const shopDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/, 'Enter a valid .myshopify.com store domain');

const connectPlatformSchema = z.object({
  channel: z.enum(['EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL', 'SHOPIFY']),
  shopDomain: shopDomainSchema.optional(),
}).strict().superRefine((data, ctx) => {
  if (data.channel === 'SHOPIFY' && !data.shopDomain) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Shopify connections require a .myshopify.com store domain',
      path: ['shopDomain'],
    });
  }
  if (data.channel !== 'SHOPIFY' && data.shopDomain !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'shopDomain is only supported for SHOPIFY',
      path: ['shopDomain'],
    });
  }
});

const authenticateSessionSchema = z.object({
  channel: z.enum(['EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL']),
  username: z.string().min(1),
  password: z.string().min(1),
}).strict();

/** OAuth channels that use redirect-based auth */
const OAUTH_CHANNELS = new Set<ExternalChannel>(['EBAY', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'SHOPIFY']);
/** Session channels that use username/password auth */
const SESSION_CHANNELS = new Set<ExternalChannel>(['POSHMARK', 'THEREALREAL']);

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generic platform connect action.
 * For OAUTH channels: returns { url, method: 'OAUTH' } — UI redirects the seller.
 * For SESSION channels: returns { method: 'SESSION' } — UI shows username/password form.
 */
export async function connectPlatformAccount(
  input: unknown,
): Promise<ActionResult<{ url?: string; method: 'OAUTH' | 'SESSION' }>> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = connectPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { channel, shopDomain } = parsed.data;
  const channelKey = channel as ExternalChannel;

  // Check if seller already has an ACTIVE account for this channel
  const [existing] = await db
    .select({ id: crosslisterAccount.id })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, sellerId),
        eq(crosslisterAccount.channel, channelKey),
        eq(crosslisterAccount.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (existing) {
    return { success: false, error: `An active ${channel} account is already connected.` };
  }

  if (SESSION_CHANNELS.has(channelKey)) {
    return { success: true, data: { method: 'SESSION' } };
  }

  if (OAUTH_CHANNELS.has(channelKey)) {
    const state = createId();
    try {
      const connector = getConnector(channelKey);
      if (!connector.buildAuthUrl) {
        return { success: false, error: `Connector for ${channel} does not support OAuth.` };
      }
      const result = await connector.buildAuthUrl(state, shopDomain);
      const url = typeof result === 'string' ? result : result.url;
      const codeVerifier = typeof result === 'string' ? undefined : result.codeVerifier;

      // Store state + optional PKCE verifier in a short-lived httpOnly cookie
      const cookieStore = await cookies();
      cookieStore.set('crosslister_oauth_state', JSON.stringify({ state, codeVerifier, shopDomain }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/api/crosslister',
      });

      return { success: true, data: { url, method: 'OAUTH' } };
    } catch (err) {
      logger.error('[connectPlatformAccount] Failed to build auth URL', { channel, error: String(err) });
      return { success: false, error: `Failed to generate ${channel} authorization URL.` };
    }
  }

  return { success: false, error: `Unsupported channel: ${channel}` };
}

/**
 * Authenticate a session-based (Tier C) platform account using username/password.
 * Gets or creates a crosslisterAccount row, calls connector.authenticate().
 */
export async function authenticateSessionAccount(
  input: unknown,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = authenticateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { channel, username, password } = parsed.data;
  const channelKey = channel as ExternalChannel;

  try {
    const connector = getConnector(channelKey);
    const authResult = await connector.authenticate({ method: 'SESSION', username, password });

    if (!authResult.success) {
      return { success: false, error: authResult.error ?? 'Authentication failed.' };
    }

    // Upsert the crosslisterAccount row
    const [existing] = await db
      .select({ id: crosslisterAccount.id })
      .from(crosslisterAccount)
      .where(and(eq(crosslisterAccount.sellerId, sellerId), eq(crosslisterAccount.channel, channelKey)))
      .limit(1);

    const encryptedSessionData = encryptSessionData(authResult.sessionData as Record<string, unknown> | null);

    if (existing) {
      await db.update(crosslisterAccount).set({
        status: 'ACTIVE',
        externalAccountId: authResult.externalAccountId,
        externalUsername: authResult.externalUsername,
        sessionData: encryptedSessionData,
        capabilities: authResult.capabilities,
        lastAuthAt: new Date(),
        firstImportCompletedAt: null,
        updatedAt: new Date(),
      }).where(eq(crosslisterAccount.id, existing.id));
    } else {
      await db.insert(crosslisterAccount).values({
        sellerId,
        channel: channelKey,
        authMethod: 'SESSION',
        status: 'ACTIVE',
        externalAccountId: authResult.externalAccountId,
        externalUsername: authResult.externalUsername,
        sessionData: encryptedSessionData,
        capabilities: authResult.capabilities,
        lastAuthAt: new Date(),
        firstImportCompletedAt: null,
      });
    }

    return { success: true };
  } catch (err) {
    logger.error('[authenticateSessionAccount] Error', { channel, error: String(err) });
    return { success: false, error: `Failed to connect ${channel} account.` };
  }
}

