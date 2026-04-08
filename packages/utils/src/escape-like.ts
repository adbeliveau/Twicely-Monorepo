/**
 * SEC-026: Escape LIKE wildcard metacharacters in user-supplied search strings.
 * Prevents `%` and `_` from being interpreted as wildcards in SQL LIKE/ILIKE patterns.
 */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}
