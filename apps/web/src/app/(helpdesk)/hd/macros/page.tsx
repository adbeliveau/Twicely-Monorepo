import type { Metadata } from 'next';
import { staffAuthorizeOrRedirect } from '@/lib/casl/staff-authorize';
import { getAllMacros } from '@/lib/queries/helpdesk-macros';
import { MacroList } from './macro-list';

export const metadata: Metadata = { title: 'Macros | Twicely Hub' };

export default async function HelpdeskMacrosPage() {
  const { ability } = await staffAuthorizeOrRedirect();
  if (!ability.can('manage', 'HelpdeskMacro')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_LEAD role required.</p>;
  }

  const macros = await getAllMacros();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "rgb(var(--hd-text-primary))" }}>
            Macros
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "rgb(var(--hd-text-muted))" }}>
            Reusable reply templates for common support scenarios.
          </p>
        </div>
      </div>
      <MacroList macros={macros} />
    </div>
  );
}
