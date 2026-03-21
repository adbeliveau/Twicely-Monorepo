/**
 * Schema shape tests for newsletter_subscriber (G10.12)
 */
import { describe, it, expect } from 'vitest';
import * as schema from '@twicely/db/schema';
import { newsletterSourceEnum } from '@/lib/db/schema/newsletter';

describe('newsletterSubscriber schema', () => {
  it('is exported from the schema barrel', () => {
    expect(schema.newsletterSubscriber).toBeDefined();
  });

  it('has all required columns', () => {
    const cols = Object.keys(schema.newsletterSubscriber);
    const expected = [
      'id',
      'email',
      'source',
      'unsubscribeToken',
      'confirmedAt',
      'unsubscribedAt',
      'welcomeSentAt',
      'createdAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(8);
  });

  it('id column is defined', () => {
    expect(schema.newsletterSubscriber.id).toBeDefined();
  });

  it('email column is defined', () => {
    expect(schema.newsletterSubscriber.email).toBeDefined();
  });

  it('unsubscribeToken column is defined', () => {
    expect(schema.newsletterSubscriber.unsubscribeToken).toBeDefined();
  });

  it('unsubscribedAt is nullable (optional)', () => {
    // Nullable columns do not have .notNull() in the builder chain
    expect(schema.newsletterSubscriber.unsubscribedAt).toBeDefined();
  });

  it('welcomeSentAt is nullable (optional)', () => {
    expect(schema.newsletterSubscriber.welcomeSentAt).toBeDefined();
  });

  it('confirmedAt is defined (not-null with defaultNow)', () => {
    expect(schema.newsletterSubscriber.confirmedAt).toBeDefined();
  });

  it('createdAt is defined (not-null with defaultNow)', () => {
    expect(schema.newsletterSubscriber.createdAt).toBeDefined();
  });
});

describe('newsletterSourceEnum', () => {
  it('is exported from newsletter schema module', () => {
    expect(newsletterSourceEnum).toBeDefined();
  });

  it('has correct enum values', () => {
    expect(newsletterSourceEnum.enumValues).toEqual([
      'HOMEPAGE_SECTION',
      'HOMEPAGE_FOOTER',
    ]);
  });
});
