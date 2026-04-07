import type { Metadata } from 'next';
import { staffAuthorizeOrRedirect } from '@/lib/casl/staff-authorize';
import { db } from '@twicely/db';
import { helpdeskSlaPolicy } from '@twicely/db/schema';
import { SlaPolicyTable } from './sla-policy-table';
import { Timer } from 'lucide-react';

export const metadata: Metadata = { title: 'SLA Policies | Twicely Hub' };

export default async function HelpdeskSlaPage() {
  const { ability } = await staffAuthorizeOrRedirect();
  if (!ability.can('manage', 'HelpdeskSlaPolicy')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_MANAGER role required.</p>;
  }

  const policies = await db.select().from(helpdeskSlaPolicy);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Timer className="h-5 w-5 text-gray-500" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">SLA Policies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Click any time value to edit inline. Policies are 1:1 with priority levels.
          </p>
        </div>
      </div>
      <SlaPolicyTable policies={policies} />
    </div>
  );
}
