import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAllAutomationRules } from '@/lib/queries/helpdesk-automation';
import { AutomationRuleList } from './automation-rule-list';
import { Zap } from 'lucide-react';

export const metadata: Metadata = { title: 'Automation Rules | Twicely Hub' };

export default async function HelpdeskAutomationPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskAutomationRule')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_MANAGER role required.</p>;
  }

  const rules = await getAllAutomationRules();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-gray-500" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Automation Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Trigger-based rules that run automatically on case events.</p>
        </div>
      </div>
      <AutomationRuleList rules={rules} />
    </div>
  );
}
