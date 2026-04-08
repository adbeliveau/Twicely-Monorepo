import { logger } from '@twicely/logger';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Twicely <noreply@twicely.co>';

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    logger.warn('[email] RESEND_API_KEY not set, skipping');
    return { success: true };
  }
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
    });
    return { success: true };
  } catch (err) {
    logger.error('[email] send failed', { error: String(err) });
    return { success: false, error: String(err) };
  }
}
