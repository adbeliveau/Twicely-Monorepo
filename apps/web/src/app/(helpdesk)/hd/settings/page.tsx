import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { platformSetting, staffUser } from '@twicely/db/schema';
import { HelpdeskSettingsForm } from './settings-form';
import { SignatureEditor } from '@/components/helpdesk/signature-editor';
import { Settings } from 'lucide-react';
import { like, eq } from 'drizzle-orm';

export const metadata: Metadata = { title: 'Settings | Twicely Hub' };

export default async function HelpdeskSettingsPage() {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskEmailConfig')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_MANAGER role required.</p>;
  }

  const [settings, agentRows] = await Promise.all([
    db.select({ key: platformSetting.key, value: platformSetting.value })
      .from(platformSetting)
      .where(like(platformSetting.key, 'helpdesk.%')),
    db.select({ signatureHtml: staffUser.signatureHtml })
      .from(staffUser)
      .where(eq(staffUser.id, session.staffUserId))
      .limit(1),
  ]);

  const signatureHtml = agentRows[0]?.signatureHtml ?? null;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-gray-500" />
        <h1 className="text-xl font-semibold text-gray-900">Helpdesk Settings</h1>
      </div>
      <HelpdeskSettingsForm settings={settings} />
      <SignatureEditor initialSignature={signatureHtml} />
    </div>
  );
}
