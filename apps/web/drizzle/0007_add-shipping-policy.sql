-- D1/D1.1: Add shippingPolicy column to seller_profile

ALTER TABLE "seller_profile" ADD COLUMN "shipping_policy" text;
