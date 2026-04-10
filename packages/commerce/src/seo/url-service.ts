/**
 * Canonical URL Service — Canonical 21 §3.3
 *
 * Generates absolute canonical URLs for all public entity types.
 */

const BASE_URL = 'https://twicely.co';

/** Get canonical URL for a listing detail page. */
export function getListingCanonicalUrl(slug: string): string {
  return `${BASE_URL}/i/${slug}`;
}

/** Get canonical URL for a category page. */
export function getCategoryCanonicalUrl(path: string): string {
  return `${BASE_URL}/c/${path}`;
}

/** Get canonical URL for a seller storefront. */
export function getStorefrontCanonicalUrl(username: string): string {
  return `${BASE_URL}/st/${username}`;
}

/** Get canonical URL for a help article. */
export function getHelpArticleCanonicalUrl(categorySlug: string, articleSlug: string): string {
  return `${BASE_URL}/h/${categorySlug}/${articleSlug}`;
}
