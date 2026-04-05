/**
 * Extract client IP from request headers, resistant to X-Forwarded-For spoofing.
 *
 * SEC-013: Use the rightmost IP in X-Forwarded-For (closest to our proxy) rather
 * than the leftmost (easily spoofable by the client). Falls back to x-real-ip.
 */
export function getClientIp(headers: Headers): string {
  // Prefer platform-specific headers (Railway, Vercel, Cloudflare)
  const railwayIp = headers.get('x-envoy-external-address');
  if (railwayIp) return railwayIp.trim();

  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // X-Forwarded-For: client, proxy1, proxy2
  // Rightmost entry is the one added by our trusted reverse proxy
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    // Take rightmost non-empty entry (added by our edge proxy)
    return parts[parts.length - 1] ?? 'unknown';
  }

  return 'unknown';
}
