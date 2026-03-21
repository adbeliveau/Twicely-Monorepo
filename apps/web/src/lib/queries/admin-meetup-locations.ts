/**
 * Admin Meetup Location Queries (E3.7 + G2.7)
 * Safe meetup location management
 */

import { db } from '@twicely/db';
import { safeMeetupLocation } from '@twicely/db/schema';
import { count, desc, eq, ilike, and, or, sum } from 'drizzle-orm';

export interface MeetupLocationRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude: number;
  longitude: number;
  type: string;
  verifiedSafe: boolean;
  meetupCount: number;
  rating: number | null;
  isActive: boolean;
  createdAt: Date;
}

export async function getMeetupLocations(opts: {
  page: number;
  pageSize: number;
  search?: string;
  activeOnly?: boolean;
}) {
  const { page, pageSize, search, activeOnly } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (activeOnly) conditions.push(eq(safeMeetupLocation.isActive, true));
  if (search) {
    conditions.push(
      or(
        ilike(safeMeetupLocation.name, `%${search}%`),
        ilike(safeMeetupLocation.city, `%${search}%`),
        ilike(safeMeetupLocation.state, `%${search}%`),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(safeMeetupLocation).where(where);

  const rows = await db
    .select()
    .from(safeMeetupLocation)
    .where(where)
    .orderBy(desc(safeMeetupLocation.createdAt))
    .limit(pageSize)
    .offset(offset);

  const locations: MeetupLocationRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    type: r.type,
    verifiedSafe: r.verifiedSafe,
    meetupCount: r.meetupCount,
    rating: r.rating,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));

  return { locations, total: totalResult?.count ?? 0 };
}

export interface AdminMeetupLocationRow extends MeetupLocationRow {
  operatingHoursJson: unknown;
  address: string;
  latitude: number;
  longitude: number;
  addedByStaffId: string | null;
  updatedAt: Date;
}

export async function getAllMeetupLocationsAdmin(filters?: {
  type?: string;
  city?: string;
  state?: string;
}): Promise<AdminMeetupLocationRow[]> {
  const conditions = [];
  if (filters?.type) conditions.push(eq(safeMeetupLocation.type, filters.type));
  if (filters?.city) conditions.push(ilike(safeMeetupLocation.city, `%${filters.city}%`));
  if (filters?.state) conditions.push(ilike(safeMeetupLocation.state, `%${filters.state}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(safeMeetupLocation)
    .where(where)
    .orderBy(desc(safeMeetupLocation.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    type: r.type,
    verifiedSafe: r.verifiedSafe,
    meetupCount: r.meetupCount,
    rating: r.rating,
    isActive: r.isActive,
    operatingHoursJson: r.operatingHoursJson,
    addedByStaffId: r.addedByStaffId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export interface MeetupLocationStats {
  total: number;
  active: number;
  inactive: number;
  verified: number;
  totalMeetups: number;
}

export async function getMeetupLocationStatsAdmin(): Promise<MeetupLocationStats> {
  const [totalResult] = await db
    .select({ count: count() })
    .from(safeMeetupLocation);

  const [activeResult] = await db
    .select({ count: count() })
    .from(safeMeetupLocation)
    .where(eq(safeMeetupLocation.isActive, true));

  const [inactiveResult] = await db
    .select({ count: count() })
    .from(safeMeetupLocation)
    .where(eq(safeMeetupLocation.isActive, false));

  const [verifiedResult] = await db
    .select({ count: count() })
    .from(safeMeetupLocation)
    .where(eq(safeMeetupLocation.verifiedSafe, true));

  const [meetupCountResult] = await db
    .select({ total: sum(safeMeetupLocation.meetupCount) })
    .from(safeMeetupLocation);

  return {
    total: totalResult?.count ?? 0,
    active: activeResult?.count ?? 0,
    inactive: inactiveResult?.count ?? 0,
    verified: verifiedResult?.count ?? 0,
    totalMeetups: Number(meetupCountResult?.total ?? 0),
  };
}
