import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAllRoutingRulesWithTeams } from '@/lib/queries/helpdesk-routing';
import { RoutingRuleList } from './routing-rule-list';
import { GitBranch } from 'lucide-react';

export const metadata: Metadata = { title: 'Routing Rules | Twicely Hub' };

export default async function HelpdeskRoutingPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskRoutingRule')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_MANAGER role required.</p>;
  }

  const rules = await getAllRoutingRulesWithTeams();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-gray-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Routing Rules</h1>
            <p className="text-sm text-gray-500 mt-0.5">First matching rule wins. Drag to reorder.</p>
          </div>
        </div>
      </div>
      <RoutingRuleList rules={rules} />
    </div>
  );
}
