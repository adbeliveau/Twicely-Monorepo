'use server';

/**
 * Admin Meetup Location Actions (E3.7 + G2.7)
 * Create, update, toggle active status for safe meetup locations
 */

import { db } from '@twicely/db';
import { safeMeetupLocation, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zip: z.string().min(1).max(20),
  country: z.string().min(2).max(5).default('US'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  type: z.string().min(1).max(50),
  verifiedSafe: z.boolean().default(false),
  operatingHoursJson: z.unknown().optional(),
}).strict();

export async function createMeetupLocationAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const data = parsed.data;

  const rows = await db
    .insert(safeMeetupLocation)
    .values({
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
      type: data.type,
      verifiedSafe: data.verifiedSafe,
      operatingHoursJson: data.operatingHoursJson ?? null,
      addedByStaffId: session.staffUserId,
    })
    .returning({ id: safeMeetupLocation.id });

  const created = rows[0];
  if (!created) return { error: 'Insert failed' };

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_MEETUP_LOCATION',
    subject: 'Setting',
    subjectId: created.id,
    severity: 'MEDIUM',
    detailsJson: { name: data.name, city: data.city },
  });

  return { success: true, id: created.id };
}

const toggleLocationSchema = z.object({
  locationId: zodId,
  isActive: z.boolean(),
}).strict();

export async function toggleMeetupLocationAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = toggleLocationSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(safeMeetupLocation)
    .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
    .where(eq(safeMeetupLocation.id, parsed.data.locationId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: parsed.data.isActive ? 'ACTIVATE_MEETUP_LOCATION' : 'DEACTIVATE_MEETUP_LOCATION',
    subject: 'Setting',
    subjectId: parsed.data.locationId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  return { success: true };
}

const updateLocationSchema = z.object({
  locationId: zodId,
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(50).optional(),
  zip: z.string().min(1).max(20).optional(),
  country: z.string().min(2).max(5).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  type: z.string().min(1).max(50).optional(),
  verifiedSafe: z.boolean().optional(),
  operatingHoursJson: z.unknown().optional(),
}).strict();

export async function updateMeetupLocationAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { locationId, ...fields } = parsed.data;

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) updateFields.name = fields.name;
  if (fields.address !== undefined) updateFields.address = fields.address;
  if (fields.city !== undefined) updateFields.city = fields.city;
  if (fields.state !== undefined) updateFields.state = fields.state;
  if (fields.zip !== undefined) updateFields.zip = fields.zip;
  if (fields.country !== undefined) updateFields.country = fields.country;
  if (fields.latitude !== undefined) updateFields.latitude = fields.latitude;
  if (fields.longitude !== undefined) updateFields.longitude = fields.longitude;
  if (fields.type !== undefined) updateFields.type = fields.type;
  if (fields.verifiedSafe !== undefined) updateFields.verifiedSafe = fields.verifiedSafe;
  if (fields.operatingHoursJson !== undefined) updateFields.operatingHoursJson = fields.operatingHoursJson;

  await db
    .update(safeMeetupLocation)
    .set(updateFields)
    .where(eq(safeMeetupLocation.id, locationId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_MEETUP_LOCATION',
    subject: 'Setting',
    subjectId: locationId,
    severity: 'MEDIUM',
    detailsJson: { updatedFields: Object.keys(fields) },
  });

  return { success: true };
}
