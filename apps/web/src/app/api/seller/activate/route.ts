import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl';
import { ensureSellerProfile } from '@/lib/listings/seller-activate';
import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';

/**
 * GET /api/seller/activate
 *
 * One-click seller activation. Creates seller profile + redirects to /my/selling.
 * Used by the "Start Selling" sidebar button.
 */
export async function GET() {
  const { session, ability } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/api/seller/activate');
  }

  if (!ability.can('create', 'SellerProfile')) {
    redirect('/my?error=unauthorized');
  }

  await ensureSellerProfile(session.userId);

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'SELLER_ACTIVATED',
    subject: 'SellerProfile',
    subjectId: session.userId,
    severity: 'LOW',
    detailsJson: {},
  });

  redirect('/my/selling');
}
