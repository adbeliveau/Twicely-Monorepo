/**
 * SEC-032: Server-side HTML sanitizer for defense-in-depth.
 * Strips dangerous tags (script, iframe, object, embed, form) and on* event handlers.
 * Client-side DOMPurify remains the primary XSS defense.
 */
export function sanitizeHtml(html: string): string {
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove dangerous tags (self-closing and open/close)
    .replace(/<\/?(?:iframe|object|embed|form|base|meta|link)\b[^>]*>/gi, '')
    // Remove on* event handlers from any tag
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}
