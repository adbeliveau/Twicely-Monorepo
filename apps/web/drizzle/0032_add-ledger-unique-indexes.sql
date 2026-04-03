-- Ledger double-apply prevention: unique partial indexes on stripe correlation IDs
CREATE UNIQUE INDEX IF NOT EXISTS "le_uniq_refund" ON "ledger_entry" ("stripe_refund_id", "type") WHERE stripe_refund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "le_uniq_dispute" ON "ledger_entry" ("stripe_dispute_id", "type") WHERE stripe_dispute_id IS NOT NULL;
