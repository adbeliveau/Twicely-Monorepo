'use server';

import { staffAuthorize } from '@twicely/casl/staff-authorize';

// Export request management is read-only in this phase.
// Export requests are initiated by users from /my/settings/privacy.
// Future: add retry and cancel actions here.

export async function retryExportAction(
  _exportId: string
): Promise<{ success: true } | { error: string }> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'DataExport')) {
    return { error: 'Forbidden' };
  }
  return { error: 'Not implemented in this phase' };
}
