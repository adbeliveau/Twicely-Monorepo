'use server';

/**
 * Crosslister account management server actions.
 * Source: F1.1 install prompt §2.3; F2 install prompt §2.0.4
 *
 * Actions: connectEbayAccount (deprecated), connectPlatformAccount,
 *          authenticateSessionAccount, disconnectAccount, refreshAccountAuth
 */

import { db } from '@twicely/db';
import { crosslisterAccount, platformSetting } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { disconnectAccountSchema } from '@/lib/validations/crosslister';
import '@/lib/crosslister/connectors'; // Ensure all connectors are registered
import { EbayConnector } from '@twicely/crosslister/connectors/ebay-connector';
import { getConnector } from '@twicely/crosslister/connector-registry';
import { logger } from '@twicely/logger';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import type { ExternalChannel } from '@twicely/crosslister/types';

const refreshAccountSchema = z.object({ accountId: z.string().min(1) }).strict();

const connectPlatformSchema = z.object({
  channel: z.enum(['EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL']),
}).strict();

const authenticateSessionSchema = z.object({
  channel: z.enum(['EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL']),
  username: z.string().min(1),
  password: z.string().min(1),
}).strict();

/** OAuth channels that use redirect-based auth */
const OAUTH_CHANNELS = new Set<ExternalChannel>(['EBAY', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED']);
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
  const parsed = connectPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const { channel } = parsed.data;
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
      const url = await connector.buildAuthUrl(state);
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
  const parsed = authenticateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
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

    if (existing) {
      await db.update(crosslisterAccount).set({
        status: 'ACTIVE',
        externalAccountId: authResult.externalAccountId,
        externalUsername: authResult.externalUsername,
        sessionData: authResult.sessionData,
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
        sessionData: authResult.sessionData,
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

/**
 * Generate eBay OAuth URL for a seller.
 * Does NOT connect — the callback route completes the connection.
 * @deprecated Use connectPlatformAccount({ channel: 'EBAY' }) instead.
 */
export async function connectEbayAccount(): Promise<ActionResult<{ url: string }>> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Check eBay import feature flag
  const [flag] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'crosslister.ebay.importEnabled'))
    .limit(1);

  if (flag?.value === false || flag?.value === 'false') {
    return { success: false, error: 'eBay import is currently disabled.' };
  }

  // Check if seller already has an ACTIVE eBay account
  const [existing] = await db
    .select({ id: crosslisterAccount.id })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, sellerId),
        eq(crosslisterAccount.channel, 'EBAY'),
        eq(crosslisterAccount.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (existing) {
    return { success: false, error: 'An active eBay account is already connected.' };
  }

  const state = createId();

  try {
    const connector = new EbayConnector();
    const url = await connector.buildAuthUrl(state);
    return { success: true, data: { url } };
  } catch (err) {
    logger.error('[connectEbayAccount] Failed to build auth URL', { error: String(err) });
    return { success: false, error: 'Failed to generate eBay authorization URL.' };
  }
}

/**
 * Disconnect a channel account — revoke auth and set status to REVOKED.
 * Does NOT delete projections (archived, not destroyed).
 */
export async function disconnectAccount(
  input: unknown,
): Promise<ActionResult> {
  const parsed = disconnectAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('delete', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.id, parsed.data.accountId),
        eq(crosslisterAccount.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (!account) {
    return { success: false, error: 'Account not found.' };
  }

  try {
    // Best-effort revoke with the external platform (generic for any channel)
    const connector = getConnector(account.channel as ExternalChannel);
    await connector.revokeAuth(account).catch(() => {
      logger.warn('[disconnectAccount] revokeAuth failed (best effort)', { accountId: account.id });
    });
  } catch (err) {
    logger.warn('[disconnectAccount] revokeAuth threw', { error: String(err) });
  }

  await db
    .update(crosslisterAccount)
    .set({
      status: 'REVOKED',
      accessToken: null,
      refreshToken: null,
      sessionData: null,
      updatedAt: new Date(),
    })
    .where(eq(crosslisterAccount.id, account.id));

  return { success: true };
}

/**
 * Proactively refresh an expired/expiring token.
 * OAuth channels: refresh via refresh token.
 * Session channels: cannot refresh — must re-authenticate.
 */
export async function refreshAccountAuth(
  input: unknown,
): Promise<ActionResult> {
  const parsed = refreshAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('CrosslisterAccount', { sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.id, parsed.data.accountId),
        eq(crosslisterAccount.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (!account) return { success: false, error: 'Account not found.' };

  const channel = account.channel as ExternalChannel;

  // Session-based channels cannot refresh tokens — must re-authenticate
  if (SESSION_CHANNELS.has(channel)) {
    await db.update(crosslisterAccount).set({
      status: 'REAUTHENTICATION_REQUIRED',
      updatedAt: new Date(),
    }).where(eq(crosslisterAccount.id, account.id));
    return { success: false, error: 'Session-based platforms require re-authentication. Please reconnect.' };
  }

  const connector = getConnector(channel);
  const result = await connector.refreshAuth(account);

  if (!result.success) {
    await db.update(crosslisterAccount).set({
      status: 'REAUTHENTICATION_REQUIRED',
      updatedAt: new Date(),
    }).where(eq(crosslisterAccount.id, account.id));
    return { success: false, error: result.error ?? 'Token refresh failed.' };
  }

  await db.update(crosslisterAccount).set({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tokenExpiresAt: result.tokenExpiresAt,
    status: 'ACTIVE',
    updatedAt: new Date(),
  }).where(eq(crosslisterAccount.id, account.id));

  return { success: true };
}
