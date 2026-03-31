/**
 * Console SMS Provider — logs SMS to stdout for local development.
 * Used when SMS_PROVIDER=console (default in dev).
 */

import { logger } from '@twicely/logger';
import type { SmsProvider, SendResult } from '../types';

export class ConsoleSmsProvider implements SmsProvider {
  async sendSms(to: string, body: string): Promise<SendResult> {
    logger.info('[ConsoleSMS] Message sent', { to, body });
    return { success: true, messageId: `console-${Date.now()}` };
  }

  async sendVerificationCode(to: string, code: string): Promise<SendResult> {
    logger.info('[ConsoleSMS] Verification code', { to, code });
    return { success: true, messageId: `console-verify-${Date.now()}` };
  }
}
