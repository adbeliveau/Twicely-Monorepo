-- G3.7: Add vacationAutoReplyMessage to seller_profile
-- Separate auto-reply message for messaging (distinct from storefront banner message).

ALTER TABLE "seller_profile" ADD COLUMN "vacation_auto_reply_message" text;
