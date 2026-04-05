'use server';

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { dataExportRequest, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export async function retryExportAction(
  exportId: string
): Promise<{ success: true } | { error: string }> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'DataExportRequest')) {
    return { error: 'Forbidden' };
  }

  if (!exportId) {
    return { error: 'Export ID is required' };
  }

  const [record] = await db
    .select()
    .from(dataExportRequest)
    .where(eq(dataExportRequest.id, exportId))
    .limit(1);

  if (!record) {
    return { error: 'Export request not found' };
  }

  if (record.status !== 'FAILED') {
    return { error: `Cannot retry export with status "${record.status}". Only failed exports can be retried.` };
  }

  await db.update(dataExportRequest)
    .set({ status: 'PENDING', updatedAt: new Date() })
    .where(eq(dataExportRequest.id, exportId));

  await db.insert(auditEvent).values({
    id: createId(),
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'DATA_EXPORT_RETRY',
    subject: 'DataExportRequest',
    subjectId: exportId,
    detailsJson: { previousStatus: record.status },
  });

  return { success: true };
}
