import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EnvironmentSettings } from '@/components/admin/settings/environment-settings';

export const metadata: Metadata = { title: 'Search Relevance | Twicely Hub' };

const WEIGHT_KEYS = [
  'discovery.search.titleWeight',
  'discovery.search.descriptionWeight',
  'discovery.search.brandWeight',
  'discovery.search.tagsWeight',
  'discovery.search.categoryWeight',
];

const BOOST_KEYS = [
  'discovery.search.phraseBoost',
  'discovery.search.sellerTrustBoost',
  'discovery.search.freshnessBoost',
  'discovery.search.promotedBoost',
];

const PAGE_SIZE_KEYS = [
  'discovery.search.defaultPageSize',
  'discovery.search.maxPageSize',
];

export default async function SearchRelevancePage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const settings = await getSettingsByKeys([...WEIGHT_KEYS, ...BOOST_KEYS, ...PAGE_SIZE_KEYS]);

  const grouped = {
    'Field Weights (multi_match)': settings.filter((s) => WEIGHT_KEYS.includes(s.key)),
    'Boost Factors (function_score)': settings.filter((s) => BOOST_KEYS.includes(s.key)),
    'Pagination': settings.filter((s) => PAGE_SIZE_KEYS.includes(s.key)),
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Relevance</span>
      </div>

      <AdminPageHeader
        title="Search Relevance"
        description="Field weights, boost factors, and pagination — controls how search results are ranked."
      />

      <EnvironmentSettings groupedSettings={grouped} canEdit={canEdit} />

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-semibold text-gray-900">How Weights Work</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
          <li><strong>Field weights</strong> control which fields contribute most to text relevance (title=10 means title matches score 10x higher than a weight-1 field)</li>
          <li><strong>Phrase boost</strong> rewards exact phrase matches (e.g. &quot;nike air max&quot; as a phrase vs individual words)</li>
          <li><strong>Seller trust boost</strong> rewards listings from high-score sellers via function_score</li>
          <li><strong>Freshness boost</strong> rewards recently listed items</li>
          <li><strong>Promoted boost</strong> controls the D2.4 boost for promoted/boosted listings (set to 0 to disable)</li>
          <li>Changes take effect on the next search query — no reindex needed</li>
        </ul>
      </div>
    </div>
  );
}
