import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Policy Versions | Twicely Hub',
  robots: { index: false, follow: false },
};

const POLICY_TYPES = [
  { key: 'terms', label: 'Terms of Service' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'seller-agreement', label: 'Seller Agreement' },
  { key: 'refund', label: 'Refund Policy' },
] as const;

export default async function PoliciesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PlatformConfig')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const policyData = await Promise.all(
    POLICY_TYPES.map(async ({ key, label }) => {
      const [version, effectiveDate] = await Promise.all([
        getPlatformSetting<string>(`policy.${key}.version`, '—'),
        getPlatformSetting<string>(`policy.${key}.effectiveDate`, '—'),
      ]);
      return { key, label, version, effectiveDate };
    })
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Policy Versions"
        description="Manage policy document versions."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {policyData.map(({ key, label, version, effectiveDate }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono font-medium">{version}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Effective date</span>
                <span className="font-mono">{effectiveDate}</span>
              </div>
              <p className="pt-2 text-xs text-muted-foreground">
                To update, use the server action{' '}
                <span className="font-mono">updatePolicyVersionAction(&apos;{key}&apos;, &apos;x.y.z&apos;)</span>.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
