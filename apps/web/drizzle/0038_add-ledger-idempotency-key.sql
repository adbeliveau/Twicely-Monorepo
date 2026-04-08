-- §4.4 Canonical idempotency key on ledger_entry — prevents duplicate ledger entries from retry storms.
-- Schema (packages/db/src/schema/finance.ts) already has this column + unique partial index, but the
-- apps/web/drizzle/ migration history was missing the corresponding ALTER. This is the catch-up
-- migration so the dev/prod ledger_entry table matches the canonical schema.
--
-- Format: order:{id}:tf | refund:{id}:full | chargeback:{id}:fee | payout:{id} |
--         reserve:hold:{id} | manual:{id} | local_cash:{id}
-- Nullable for back-compat with existing rows; new entries must populate it.

ALTER TABLE "ledger_entry"
  ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "le_uniq_idempotency"
  ON "ledger_entry" ("idempotency_key")
  WHERE idempotency_key IS NOT NULL;
