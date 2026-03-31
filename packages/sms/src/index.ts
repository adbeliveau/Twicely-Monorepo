/**
 * @twicely/sms — SMS provider abstraction with Telnyx backend.
 *
 * Usage:
 *   import { getSmsProvider, sendVerificationCode, verifyCode } from '@twicely/sms';
 *
 * Provider selection: SMS_PROVIDER env var ('telnyx' | 'console', default: 'console')
 */

import type { SmsProvider } from './types';

export type { SmsProvider, SendResult, VerifyResult } from './types';
export { sendVerificationCode, verifyCode, generateCode } from './verification';

let _provider: SmsProvider | null = null;

/**
 * Get the configured SMS provider singleton.
 * - SMS_PROVIDER=telnyx → TelnyxSmsProvider (real SMS)
 * - SMS_PROVIDER=console → ConsoleSmsProvider (logs to console)
 */
export function getSmsProvider(): SmsProvider {
  if (_provider) return _provider;

  const providerName = process.env.SMS_PROVIDER ?? 'console';

  switch (providerName) {
    case 'telnyx': {
      const { TelnyxSmsProvider } = require('./providers/telnyx') as {
        TelnyxSmsProvider: new () => SmsProvider;
      };
      _provider = new TelnyxSmsProvider();
      break;
    }
    case 'console':
    default: {
      const { ConsoleSmsProvider } = require('./providers/console') as {
        ConsoleSmsProvider: new () => SmsProvider;
      };
      _provider = new ConsoleSmsProvider();
      break;
    }
  }

  return _provider;
}

/** Reset the provider singleton (for testing). */
export function resetSmsProvider(): void {
  _provider = null;
}
