/**
 * Scan puckData for FeaturedListings blocks and extract listing IDs.
 * Puck data is opaque JSON — walk the content array looking for matching type.
 */
export function extractFeaturedListingIds(puckData: unknown): string[] {
  if (!puckData || typeof puckData !== 'object') return [];

  const data = puckData as { content?: Array<{ type?: string; props?: { listingIds?: string } }> };
  if (!Array.isArray(data.content)) return [];

  const ids: string[] = [];
  for (const item of data.content) {
    if (item.type === 'FeaturedListings' && item.props?.listingIds) {
      const parsed = item.props.listingIds
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      ids.push(...parsed);
    }
  }

  // Deduplicate
  return [...new Set(ids)];
}
