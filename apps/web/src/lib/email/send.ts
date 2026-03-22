import { logger } from '@twicely/logger';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
      from: 'Twicely <noreply@twicely.co>',
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
