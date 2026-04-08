/**
 * Seed safe meetup location data: 5 sample locations for testing.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { safeMeetupLocation } from '@twicely/db/schema';

const SEED_LOCATIONS = [
  {
    name: 'Austin Police Department - HQ',
    address: '715 E 8th St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'US',
    latitude: 30.2700,
    longitude: -97.7370,
    type: 'POLICE_STATION',
    verifiedSafe: true,
    isActive: true,
    operatingHoursJson: { mon: '0800-2000', tue: '0800-2000', wed: '0800-2000', thu: '0800-2000', fri: '0800-2000', sat: '0900-1700', sun: 'CLOSED' },
  },
  {
    name: 'Barton Creek Square Mall - Guest Services',
    address: '2901 S Capital of Texas Hwy',
    city: 'Austin',
    state: 'TX',
    zip: '78746',
    country: 'US',
    latitude: 30.2607,
    longitude: -97.7933,
    type: 'RETAIL',
    verifiedSafe: true,
    isActive: true,
    operatingHoursJson: { mon: '1000-2100', tue: '1000-2100', wed: '1000-2100', thu: '1000-2100', fri: '1000-2100', sat: '1000-2100', sun: '1200-1800' },
  },
  {
    name: 'Dove Springs Community Center',
    address: '5801 Ainez Dr',
    city: 'Austin',
    state: 'TX',
    zip: '78744',
    country: 'US',
    latitude: 30.1960,
    longitude: -97.7384,
    type: 'COMMUNITY',
    verifiedSafe: true,
    isActive: true,
    operatingHoursJson: { mon: '0900-2100', tue: '0900-2100', wed: '0900-2100', thu: '0900-2100', fri: '0900-2100', sat: '0900-1700', sun: 'CLOSED' },
  },
  {
    name: 'Round Rock Public Library',
    address: '216 E Main St',
    city: 'Round Rock',
    state: 'TX',
    zip: '78664',
    country: 'US',
    latitude: 30.5083,
    longitude: -97.6789,
    type: 'COMMUNITY',
    verifiedSafe: true,
    isActive: true,
    operatingHoursJson: { mon: '1000-2100', tue: '1000-2100', wed: '1000-2100', thu: '1000-2100', fri: '1000-1800', sat: '1000-1800', sun: '1300-1700' },
  },
  {
    name: 'San Marcos Premium Outlets - Information Desk',
    address: '3939 IH-35 S',
    city: 'San Marcos',
    state: 'TX',
    zip: '78666',
    country: 'US',
    latitude: 29.8360,
    longitude: -97.9667,
    type: 'RETAIL',
    verifiedSafe: false,
    isActive: false,
    operatingHoursJson: { mon: '1000-2100', tue: '1000-2100', wed: '1000-2100', thu: '1000-2100', fri: '1000-2100', sat: '1000-2100', sun: '1000-1900' },
  },
];

export async function seedLocalMeetupLocations(db: PostgresJsDatabase): Promise<void> {
  await db.insert(safeMeetupLocation).values(SEED_LOCATIONS).onConflictDoNothing();
}

export { SEED_LOCATIONS };
