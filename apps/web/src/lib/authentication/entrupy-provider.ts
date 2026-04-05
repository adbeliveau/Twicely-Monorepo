/**
 * Entrupy AI authentication provider implementation.
 * All API calls via fetch(). API URL and webhook secret from platform_settings.
 * User-facing UI must never surface the name "Entrupy" — only "AI Authentication".
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { AUTH_SETTINGS_KEYS } from './constants';
import type { AiAuthProvider, AiAuthSubmission, AiAuthResult } from './ai-provider';

interface EntrupyApiAuth {
  id: string;
  status: string;
  confidence?: number;
  result_notes?: string;
  [key: string]: unknown;
}

interface EntrupyWebhookPayload {
  id: string;
  status: string;
  confidence?: number;
  result_notes?: string;
  [key: string]: unknown;
}

function mapEntrupyStatus(status: string): AiAuthResult['status'] {
  if (status === 'authentic') return 'AUTHENTICATED';
  if (status === 'unacceptable' || status === 'inconclusive') return 'INCONCLUSIVE';
  if (status === 'fake') return 'COUNTERFEIT';
  // Default unmapped statuses to INCONCLUSIVE (safe fallback — Twicely absorbs cost)
  return 'INCONCLUSIVE';
}

export class EntrupyProvider implements AiAuthProvider {
  readonly name = 'entrupy';

  async submitForAuthentication(
    submission: AiAuthSubmission
  ): Promise<{ providerRef: string; submittedAt: Date }> {
    const apiUrl = await getPlatformSetting<string>(
      AUTH_SETTINGS_KEYS.AI_PROVIDER_API_URL,
      'https://api.entrupy.com/v1'
    );

    const response = await fetch(`${apiUrl}/authentications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_id: submission.requestId,
        image_urls: submission.photoUrls,
        category: submission.category,
        item_title: submission.itemTitle,
        item_price_cents: submission.itemPriceCents,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `AI authentication provider submission failed: ${response.status}`
      );
    }

    const data = (await response.json()) as { id: string };
    return { providerRef: data.id, submittedAt: new Date() };
  }

  async getResult(providerRef: string): Promise<AiAuthResult | null> {
    const apiUrl = await getPlatformSetting<string>(
      AUTH_SETTINGS_KEYS.AI_PROVIDER_API_URL,
      'https://api.entrupy.com/v1'
    );

    const response = await fetch(`${apiUrl}/authentications/${providerRef}`);

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `AI authentication provider lookup failed: ${response.status}`
      );
    }

    const data = (await response.json()) as EntrupyApiAuth;
    const status = data.status;

    // Return null when still in progress
    if (status === 'in_progress' || status === 'pending') return null;

    return {
      providerRef,
      status: mapEntrupyStatus(status),
      confidence: data.confidence ?? 0,
      resultJson: data as Record<string, unknown>,
      resultNotes: data.result_notes ?? '',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = (
      typeof process !== 'undefined'
        ? process.env['AI_PROVIDER_WEBHOOK_SECRET'] ?? ''
        : ''
    );

    if (!secret || !signature) return false;

    try {
      const computed = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      const computedBuf = Buffer.from(computed, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');
      if (computedBuf.length !== signatureBuf.length) return false;
      return timingSafeEqual(computedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  parseWebhookResult(payload: string): AiAuthResult {
    const data = JSON.parse(payload) as EntrupyWebhookPayload;
    return {
      providerRef: data.id,
      status: mapEntrupyStatus(data.status),
      confidence: data.confidence ?? 0,
      resultJson: data as Record<string, unknown>,
      resultNotes: data.result_notes ?? '',
    };
  }
}
