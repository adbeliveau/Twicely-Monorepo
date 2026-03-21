import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { listing, order, category, user } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';

// These tests require a seeded database
// Run: npx tsx src/lib/db/seed.ts before running these tests

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  client = postgres(connectionString);
  db = drizzle(client);
});

afterAll(async () => {
  // Close DB connection pool
  await client.end();
});

describe('Database query integration tests', () => {
  describe('Listing queries', () => {
    it('can fetch active listings with all required fields', async () => {
      const listings = await db
        .select({
          id: listing.id,
          title: listing.title,
          slug: listing.slug,
          priceCents: listing.priceCents,
          shippingCents: listing.shippingCents,
          freeShipping: listing.freeShipping,
          status: listing.status,
          ownerUserId: listing.ownerUserId,
        })
        .from(listing)
        .where(eq(listing.status, 'ACTIVE'))
        .limit(5);

      expect(listings.length).toBeGreaterThan(0);

      const first = listings[0]!;
      expect(first.id).toBeTruthy();
      expect(first.title).toBeTruthy();
      expect(first.slug).toBeTruthy();
      expect(first.priceCents).toBeGreaterThan(0);
      expect(typeof first.shippingCents).toBe('number');
      expect(typeof first.freeShipping).toBe('boolean');
      // Shipping logic: free shipping means 0 cents
      if (first.freeShipping) {
        expect(first.shippingCents).toBe(0);
      }
    });

    it('can fetch listing by slug with all detail fields', async () => {
      // Get any listing slug first
      const [any] = await db
        .select({ slug: listing.slug })
        .from(listing)
        .where(eq(listing.status, 'ACTIVE'))
        .limit(1);

      expect(any).toBeTruthy();
      expect(any!.slug).toBeTruthy();

      const results = await db
        .select()
        .from(listing)
        .where(eq(listing.slug, any!.slug!))
        .limit(1);

      expect(results.length).toBe(1);
      const detail = results[0]!;
      expect(detail.priceCents).toBeGreaterThan(0);
      expect(detail.categoryId).toBeTruthy();
    });
  });

  describe('Category queries', () => {
    it('can fetch categories', async () => {
      const categories = await db
        .select({
          id: category.id,
          name: category.name,
          slug: category.slug,
        })
        .from(category)
        .limit(10);

      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]!.name).toBeTruthy();
      expect(categories[0]!.slug).toBeTruthy();
    });
  });

  describe('Order queries', () => {
    it('can fetch orders with correct field types', async () => {
      const orders = await db
        .select({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalCents: order.totalCents,
          shippingCents: order.shippingCents,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
        })
        .from(order)
        .limit(5);

      expect(orders.length).toBeGreaterThan(0);

      const first = orders[0]!;
      expect(first.orderNumber).toMatch(/^(TWC-|ORD-)/); // Accept both formats
      expect(first.totalCents).toBeGreaterThan(0);
      expect(typeof first.shippingCents).toBe('number');
      expect(first.buyerId).toBeTruthy();
      expect(first.sellerId).toBeTruthy();
    });
  });

  describe('Shipping cents consistency', () => {
    it('has realistic shipping values in seed data', async () => {
      const distribution = await db
        .select({
          shippingCents: listing.shippingCents,
          count: sql<number>`count(*)`,
        })
        .from(listing)
        .groupBy(listing.shippingCents)
        .orderBy(listing.shippingCents);

      // Should have multiple distinct values (not all 0)
      expect(distribution.length).toBeGreaterThan(1);

      // Should have some free shipping
      const free = distribution.find(d => d.shippingCents === 0);
      expect(free).toBeTruthy();
      expect(Number(free!.count)).toBeGreaterThanOrEqual(10);
    });
  });

  describe('User queries', () => {
    it('can fetch users with seller status', async () => {
      const users = await db
        .select({
          id: user.id,
          email: user.email,
          isSeller: user.isSeller,
        })
        .from(user)
        .limit(5);

      expect(users.length).toBeGreaterThan(0);
      // Should have at least one seller in seed data
      const sellers = users.filter(u => u.isSeller);
      expect(sellers.length).toBeGreaterThan(0);
    });
  });
});
