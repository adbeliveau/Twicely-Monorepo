import { db } from '@twicely/db';
import { safeMeetupLocation } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export type SafeMeetupLocationRow = typeof safeMeetupLocation.$inferSelect;

/**
 * Get all active safe meetup locations.
 * Optionally filter by city and state.
 * Ordered by meetupCount DESC (most popular first).
 */
export async function getActiveSafeMeetupLocations(
  city?: string,
  state?: string
): Promise<SafeMeetupLocationRow[]> {
  const conditions = [eq(safeMeetupLocation.isActive, true)];

  if (city !== undefined) {
    conditions.push(eq(safeMeetupLocation.city, city));
  }
  if (state !== undefined) {
    conditions.push(eq(safeMeetupLocation.state, state));
  }

  return db
    .select()
    .from(safeMeetupLocation)
    .where(and(...conditions))
    .orderBy(sql`${safeMeetupLocation.meetupCount} DESC`);
}

/**
 * Get a single safe meetup location by ID.
 */
export async function getSafeMeetupLocationById(
  locationId: string
): Promise<SafeMeetupLocationRow | null> {
  const [row] = await db
    .select()
    .from(safeMeetupLocation)
    .where(eq(safeMeetupLocation.id, locationId))
    .limit(1);

  return row ?? null;
}

/**
 * Get safe meetup locations within a radius (miles) of a point.
 * Uses Haversine formula in SQL. Ordered by distance ASC.
 *
 * @param latitude - Center latitude in degrees
 * @param longitude - Center longitude in degrees
 * @param radiusMiles - Search radius in miles
 */
export async function getNearbyMeetupLocations(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<Array<SafeMeetupLocationRow & { distanceMiles: number }>> {
  const rows = await db
    .select({
      id: safeMeetupLocation.id,
      name: safeMeetupLocation.name,
      address: safeMeetupLocation.address,
      city: safeMeetupLocation.city,
      state: safeMeetupLocation.state,
      zip: safeMeetupLocation.zip,
      country: safeMeetupLocation.country,
      latitude: safeMeetupLocation.latitude,
      longitude: safeMeetupLocation.longitude,
      type: safeMeetupLocation.type,
      verifiedSafe: safeMeetupLocation.verifiedSafe,
      operatingHoursJson: safeMeetupLocation.operatingHoursJson,
      meetupCount: safeMeetupLocation.meetupCount,
      rating: safeMeetupLocation.rating,
      isActive: safeMeetupLocation.isActive,
      addedByStaffId: safeMeetupLocation.addedByStaffId,
      createdAt: safeMeetupLocation.createdAt,
      updatedAt: safeMeetupLocation.updatedAt,
      distanceMiles: sql<number>`(
        3959 * acos(
          cos(radians(${latitude})) *
          cos(radians(${safeMeetupLocation.latitude})) *
          cos(radians(${safeMeetupLocation.longitude}) - radians(${longitude})) +
          sin(radians(${latitude})) *
          sin(radians(${safeMeetupLocation.latitude}))
        )
      )`,
    })
    .from(safeMeetupLocation)
    .where(
      and(
        eq(safeMeetupLocation.isActive, true),
        sql`(
          3959 * acos(
            cos(radians(${latitude})) *
            cos(radians(${safeMeetupLocation.latitude})) *
            cos(radians(${safeMeetupLocation.longitude}) - radians(${longitude})) +
            sin(radians(${latitude})) *
            sin(radians(${safeMeetupLocation.latitude}))
          )
        ) <= ${radiusMiles}`
      )
    )
    .orderBy(
      sql`(
        3959 * acos(
          cos(radians(${latitude})) *
          cos(radians(${safeMeetupLocation.latitude})) *
          cos(radians(${safeMeetupLocation.longitude}) - radians(${longitude})) +
          sin(radians(${latitude})) *
          sin(radians(${safeMeetupLocation.latitude}))
        )
      ) ASC`
    );

  return rows;
}
