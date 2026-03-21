import { db } from '@twicely/db';
import { sequenceCounter } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Generate the next sequential helpdesk case number atomically.
 * Returns a string like "HD-000001".
 */
export async function generateCaseNumber(): Promise<string> {
  const rows = await db
    .update(sequenceCounter)
    .set({
      currentValue: sql`${sequenceCounter.currentValue} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(sequenceCounter.name, 'case_number'))
    .returning({
      currentValue: sequenceCounter.currentValue,
      prefix: sequenceCounter.prefix,
      paddedWidth: sequenceCounter.paddedWidth,
    });

  const row = rows[0];
  if (!row) {
    throw new Error('Sequence counter "case_number" not found. Run seed first.');
  }

  const { currentValue, prefix, paddedWidth } = row;
  return `${prefix}${String(currentValue).padStart(paddedWidth, '0')}`;
}
