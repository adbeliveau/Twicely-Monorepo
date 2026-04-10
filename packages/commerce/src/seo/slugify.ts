/**
 * Slug generation utility — Canonical 21 §3.2
 */

/** Convert text to a URL-safe slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
