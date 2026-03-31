/**
 * SMS Provider Abstraction — allows swapping Telnyx for Vonage/Twilio
 * without changing application code.
 */

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  /** Send a raw SMS message. */
  sendSms(to: string, body: string): Promise<SendResult>;

  /** Send a verification code SMS with standard template. */
  sendVerificationCode(to: string, code: string): Promise<SendResult>;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
}
