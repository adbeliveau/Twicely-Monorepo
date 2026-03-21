import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByCategory } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EnvironmentSettings } from '@/components/admin/settings/environment-settings';

export const metadata: Metadata = { title: 'Environment Settings | Twicely Hub' };

export default async function EnvironmentSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const grouped = await getSettingsByCategory();

  // Collect all settings that are secrets or have environment-related categories
  const envCategories = ['environment', 'integrations', 'stripe', 'auth'];
  const envSettings = envCategories.flatMap((cat) => grouped[cat] ?? []);

  // Group by category for display
  const byCategory: Record<string, typeof envSettings> = {};
  for (const s of envSettings) {
    const cat = s.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(s);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Environment</span>
      </div>

      <AdminPageHeader
        title="Environment Settings"
        description="Single source of truth for all API keys, secrets, and configuration. These settings are read by the entire application."
      />

      <EnvironmentSettings groupedSettings={byCategory} canEdit={canEdit} />

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-semibold text-yellow-900">Important Notes</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-800">
          <li><strong>Single source of truth:</strong> All API keys and secrets are managed here</li>
          <li>Sensitive values (API keys, secrets) are encrypted before storage</li>
          <li>Settings are read from database first, falling back to .env if not found</li>
          <li>Changes take effect immediately for new requests</li>
          <li>Some settings may require application restart (DATABASE_URL, BETTER_AUTH_SECRET)</li>
        </ul>
      </div>
    </div>
  );
}
