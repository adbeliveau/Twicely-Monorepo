/**
 * Telnyx SMS Provider — sends real SMS via the Telnyx API (v6 SDK).
 * Used when SMS_PROVIDER=telnyx.
 */

import Telnyx from 'telnyx';
import { logger } from '@twicely/logger';
import type { SmsProvider, SendResult } from '../types';

export class TelnyxSmsProvider implements SmsProvider {
  private client: Telnyx;
  private fromNumber: string;
  private messagingProfileId: string | undefined;

  constructor() {
    const apiKey = process.env.TELNYX_API_KEY;
    if (!apiKey) {
      throw new Error('TELNYX_API_KEY is required for Telnyx SMS provider');
    }

    this.client = new Telnyx({ apiKey });
    this.fromNumber = process.env.TELNYX_FROM_NUMBER ?? '';
    this.messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;

    if (!this.fromNumber) {
      throw new Error('TELNYX_FROM_NUMBER is required');
    }
  }

  async sendSms(to: string, body: string): Promise<SendResult> {
    try {
      const response = await this.client.messages.send({
        from: this.fromNumber,
        to,
        text: body,
        ...(this.messagingProfileId
          ? { messaging_profile_id: this.messagingProfileId }
          : {}),
      });

      const msgId = response?.data?.id;
      logger.info('SMS sent via Telnyx', { to: maskPhone(to), messageId: msgId });
      return { success: true, messageId: msgId ? String(msgId) : undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Telnyx send failed';
      logger.error('SMS send failed', { to: maskPhone(to), error: message });
      return { success: false, error: message };
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<SendResult> {
    const body = `Your Twicely verification code is ${code}. It expires in 10 minutes. Do not share this code.`;
    return this.sendSms(to, body);
  }
}

/** Mask phone for logging — show last 4 digits only. */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return '****' + phone.slice(-4);
}
