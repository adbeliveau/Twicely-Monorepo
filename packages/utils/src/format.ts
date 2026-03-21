/**
 * Formatting utilities for the Twicely marketplace
 */

/**
 * Format a price in cents to a display string
 * @param cents - Price in cents (e.g., 9999 = $99.99)
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted price string (e.g., '$99.99')
 */
export function formatPrice(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a date for display
 * @param date - Date object or ISO string
 * @param options - Intl.DateTimeFormatOptions or preset name
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions | 'short' | 'long' | 'relative' = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (options === 'short') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }

  if (options === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }

  if (options === 'relative') {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Pluralize a word based on count
 * @param count - The number
 * @param singular - Singular form of the word
 * @param plural - Plural form (defaults to singular + 's')
 * @returns Pluralized string with count (e.g., '1 item', '5 items')
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with '...' if needed
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Build a URL for a listing detail page
 * @param listingId - The listing ID
 * @param slug - Optional URL-friendly slug
 * @returns URL path for the listing
 */
export function buildListingUrl(slug: string): string {
  return `/i/${slug}`;
}

/**
 * Build a URL for a category browse page
 * @param categorySlug - The category slug
 * @param subcategorySlug - Optional subcategory slug
 * @returns URL path for the category
 */
export function buildCategoryUrl(
  categorySlug: string,
  subcategorySlug?: string
): string {
  if (subcategorySlug) {
    return `/c/${categorySlug}/${subcategorySlug}`;
  }
  return `/c/${categorySlug}`;
}

/**
 * Generate a URL-friendly slug from a string
 * @param text - Text to convert to slug
 * @returns URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format a number with commas for thousands
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}
