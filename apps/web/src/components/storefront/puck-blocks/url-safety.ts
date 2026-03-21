/** Check if a URL is safe for use in href attributes (blocks javascript:, data:, etc.) */
export function isSafeHref(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** Check if a URL is safe for use in CSS url() (only absolute https/http) */
export function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
