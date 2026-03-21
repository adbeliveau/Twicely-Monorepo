-- G2.11: Add canceledByParty column to local_transaction
-- Captures 'BUYER' or 'SELLER' as reporting sub-state of CANCELED.
-- Mirrors the pattern used by noShowParty on the same table.

ALTER TABLE "local_transaction"
  ADD COLUMN "canceled_by_party" text;
