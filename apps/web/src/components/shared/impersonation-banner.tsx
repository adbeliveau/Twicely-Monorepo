import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { user } from '@twicely/db/schema';
import { getImpersonationSession } from '@twicely/auth/impersonation';
import { EndImpersonationButton } from './impersonation-banner-end-button';

async function getTargetUser(
  userId: string
): Promise<{ name: string; email: string } | null> {
  const [row] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}

export async function ImpersonationBanner() {
  const session = await getImpersonationSession();
  if (!session) return null;

  const targetUser = await getTargetUser(session.targetUserId);
  if (!targetUser) return null;

  const expiresAt = new Date(session.expiresAt);
  const formattedExpiry = expiresAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center justify-between border-b border-amber-300 bg-amber-50 px-6 py-2"
    >
      <div className="flex items-center gap-6 text-sm text-amber-900">
        <span className="font-semibold">Impersonation Active</span>
        <span>
          Viewing as: <strong>{targetUser.name}</strong> ({targetUser.email})
        </span>
        <span>Staff: {session.staffDisplayName}</span>
        <span>Session expires: {formattedExpiry}</span>
      </div>

      <EndImpersonationButton />
    </div>
  );
}
