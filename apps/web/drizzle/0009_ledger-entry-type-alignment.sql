-- Ledger Entry Type Enum Alignment (B-phase spec compliance)
-- Rename invented values to spec-correct names, add missing values

-- Rename ORDER_LOCAL_FEE → LOCAL_TRANSACTION_FEE
ALTER TYPE "ledger_entry_type" RENAME VALUE 'ORDER_LOCAL_FEE' TO 'LOCAL_TRANSACTION_FEE';

-- Rename ORDER_AUTH_FEE → AUTH_FEE_BUYER
ALTER TYPE "ledger_entry_type" RENAME VALUE 'ORDER_AUTH_FEE' TO 'AUTH_FEE_BUYER';

-- Add missing auth fee variants
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'AUTH_FEE_SELLER';
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'AUTH_FEE_REFUND';

-- Add missing finance/affiliate values
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'FINANCE_SUBSCRIPTION_CHARGE';
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'AFFILIATE_COMMISSION_PAYOUT';
