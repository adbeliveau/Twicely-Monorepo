/**
 * Certificate number generation utility for authentication requests.
 * NOT a server action — pure utility, no CASL dependency.
 * The existing generateUniqueCertNumber() in authentication.ts
 * is a thin wrapper that adds CASL authorization on top of this.
 */

import { db } from '@twicely/db';
import { authenticationRequest } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { CERTIFICATE_PREFIX } from './constants';

const CERT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a unique certificate number without any authorization check.
 * Callers are responsible for ensuring the caller is authorized to create
 * authentication requests before calling this function.
 */
export async function generateCertNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += CERT_CHARS[Math.floor(Math.random() * CERT_CHARS.length)];
    }
    const certNumber = `${CERTIFICATE_PREFIX}${suffix}`;
    const [existing] = await db
      .select({ id: authenticationRequest.id })
      .from(authenticationRequest)
      .where(eq(authenticationRequest.certificateNumber, certNumber))
      .limit(1);
    if (!existing) return certNumber;
  }
  throw new Error('Failed to generate unique certificate number after 10 attempts');
}
