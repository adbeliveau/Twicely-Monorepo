-- G5 Audit Fix: Add suspendedUntil column for time-limited affiliate suspensions
-- Per TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL §2.9 three-strikes policy
ALTER TABLE "affiliate" ADD COLUMN "suspended_until" TIMESTAMP WITH TIME ZONE;
