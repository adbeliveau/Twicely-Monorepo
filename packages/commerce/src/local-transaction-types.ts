/**
 * Type-only re-export for LocalTransactionRow.
 * Extracted from apps/web/src/lib/queries/local-transaction.ts
 */
import { localTransaction } from '@twicely/db/schema';

export type LocalTransactionRow = typeof localTransaction.$inferSelect;
