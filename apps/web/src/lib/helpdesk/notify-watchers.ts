/**
 * Utility to notify case watchers on case activity.
 * NOT a server action — plain async function.
 * Per G9.6 install prompt §2F.
 */

import { db } from '@twicely/db';
import { caseWatcher, helpdeskCase } from '@twicely/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';

/**
 * Notify all watchers of a case (except the acting agent) about case activity.
 * Fire-and-forget: errors are logged by the notify() function and never re-thrown.
 */
export async function notifyCaseWatchers(
  caseId: string,
  excludeStaffUserId: string,
  eventDescription: string
): Promise<void> {
  const conditions = [eq(caseWatcher.caseId, caseId)];
  if (excludeStaffUserId) {
    conditions.push(ne(caseWatcher.staffUserId, excludeStaffUserId));
  }

  const [watchers, caseRows] = await Promise.all([
    db
      .select({ staffUserId: caseWatcher.staffUserId })
      .from(caseWatcher)
      .where(and(...conditions)),
    db
      .select({ caseNumber: helpdeskCase.caseNumber, subject: helpdeskCase.subject })
      .from(helpdeskCase)
      .where(eq(helpdeskCase.id, caseId))
      .limit(1),
  ]);

  const caseRecord = caseRows[0];
  if (!caseRecord) return;

  await Promise.all(
    watchers.map((w) =>
      notify(w.staffUserId, 'helpdesk.case.watcher_update', {
        caseNumber: caseRecord.caseNumber,
        subject: caseRecord.subject,
        eventDescription,
        caseUrl: `/hd/cases/${caseId}`,
      })
    )
  );
}
