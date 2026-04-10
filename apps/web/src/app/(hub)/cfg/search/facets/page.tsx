import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Search Facets | Twicely Hub' };

/**
 * Facet configuration derived from the OpenSearch mapping (FACET_FIELDS).
 * Each entry describes a facet used in search aggregations.
 */
const FACET_DEFINITIONS = [
  { field: 'condition', label: 'Condition', type: 'keyword', multiSelect: true, description: 'Item condition (NEW, LIKE_NEW, GOOD, FAIR, POOR)' },
  { field: 'categoryId', label: 'Category', type: 'keyword', multiSelect: false, description: 'Primary category for drill-down navigation' },
  { field: 'brand', label: 'Brand', type: 'keyword (text+keyword multi-field)', multiSelect: true, description: 'Brand name — uses brand.keyword for aggregation' },
  { field: 'freeShipping', label: 'Free Shipping', type: 'boolean', multiSelect: false, description: 'Whether the listing offers free shipping' },
  { field: 'fulfillmentType', label: 'Fulfillment', type: 'keyword', multiSelect: false, description: 'Fulfillment method (SHIPPED, LOCAL, BOTH)' },
  { field: 'sellerPerformanceBand', label: 'Seller Band', type: 'keyword', multiSelect: true, description: 'Seller performance tier (TOP, GREAT, GOOD, AVERAGE, AT_RISK)' },
  { field: 'authenticationStatus', label: 'Authentication', type: 'keyword', multiSelect: false, description: 'Item authentication status (AUTHENTICATED, PENDING, NOT_REQUIRED)' },
  { field: 'storefrontCategoryId', label: 'Storefront Category', type: 'keyword', multiSelect: false, description: 'Seller storefront category for in-store navigation' },
] as const;

export default async function SearchFacetsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Facets</span>
      </div>

      <AdminPageHeader
        title="Search Facets"
        description="Faceted filters shown on search and category pages. Controls which fields appear as filter options."
      />

      {/* Facet Registry */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Active Facets</h3>
          <p className="mt-1 text-sm text-gray-500">
            These facets are defined in the OpenSearch mapping and Typesense schema.
            Each generates a <code className="rounded bg-gray-100 px-1">terms</code> aggregation in queries.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Field</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Label</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Multi-Select</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {FACET_DEFINITIONS.map((facet) => (
                <tr key={facet.field}>
                  <td className="px-4 py-2 font-mono text-xs">{facet.field}</td>
                  <td className="px-4 py-2 font-medium">{facet.label}</td>
                  <td className="px-4 py-2 text-gray-500">{facet.type}</td>
                  <td className="px-4 py-2 text-center">
                    {facet.multiSelect ? (
                      <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Yes</span>
                    ) : (
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{facet.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How Facets Work */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-semibold text-gray-900">How Facets Work</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
          <li><strong>OpenSearch:</strong> Each facet field generates a <code className="rounded bg-gray-100 px-1">terms</code> aggregation in the query DSL, returning bucket counts for each value</li>
          <li><strong>Typesense:</strong> Fields with <code className="rounded bg-gray-100 px-1">facet: true</code> in the schema are included in <code className="rounded bg-gray-100 px-1">facet_by</code></li>
          <li><strong>Multi-select:</strong> When enabled, selecting a facet value does not exclude other values in the same facet group (OR logic within group)</li>
          <li><strong>Display order:</strong> Facets appear in the order listed above on the search/category pages</li>
          <li>To add a new facet field, update the OpenSearch mapping and Typesense schema, then reindex</li>
        </ul>
      </div>

      {/* Engine Comparison */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Engine Facet Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Feature</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">OpenSearch</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Typesense</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2 font-medium">Aggregation type</td>
                <td className="px-4 py-2">terms aggregation (custom bucket size)</td>
                <td className="px-4 py-2">Built-in facet_by (max 250 values)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Nested facets</td>
                <td className="px-4 py-2">Supported (nested aggregations)</td>
                <td className="px-4 py-2">Not supported</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Range facets</td>
                <td className="px-4 py-2">histogram / range aggregation</td>
                <td className="px-4 py-2">Not directly supported</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Stats facets</td>
                <td className="px-4 py-2">stats / extended_stats aggregation</td>
                <td className="px-4 py-2">Not supported</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
