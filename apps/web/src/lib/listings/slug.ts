import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Convert a string to kebab-case.
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Generate a random alphanumeric suffix.
 */
function randomSuffix(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i]! % chars.length);
  }
  return result;
}

/**
 * Generate a unique slug for a listing.
 * Format: {kebab-title}-{6-char-random}
 * Retries if slug already exists (rare).
 */
export async function generateListingSlug(title: string): Promise<string> {
  const base = toKebabCase(title) || 'listing';
  const truncated = base.slice(0, 50); // Keep base slug reasonable length

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${truncated}-${randomSuffix()}`;

    // Check if slug exists
    const existing = await db
      .select({ id: listing.id })
      .from(listing)
      .where(eq(listing.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      return slug;
    }
  }

  // Fallback with longer suffix if all attempts fail (extremely unlikely)
  return `${truncated}-${randomSuffix(10)}`;
}
