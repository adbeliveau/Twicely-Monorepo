-- G3.6: Creator Affiliate Listing Links
-- Adds affiliate opt-in and custom commission rate to seller_profile.
-- Adds listing_id to referral for listing-level attribution tracking.

ALTER TABLE seller_profile ADD COLUMN affiliate_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE seller_profile ADD COLUMN affiliate_commission_bps integer;
ALTER TABLE referral ADD COLUMN listing_id text REFERENCES listing(id);
CREATE INDEX ref_listing ON referral(listing_id);
