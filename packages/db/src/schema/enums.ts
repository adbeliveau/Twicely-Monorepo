import { pgEnum } from 'drizzle-orm/pg-core';

// §1.1 Identity & Auth
export const sellerTypeEnum = pgEnum('seller_type', ['PERSONAL', 'BUSINESS']);
export const sellerStatusEnum = pgEnum('seller_status', ['ACTIVE', 'RESTRICTED', 'SUSPENDED']);
export const businessTypeEnum = pgEnum('business_type', ['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP']);
export const platformRoleEnum = pgEnum('platform_role', [
  'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
  'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN'
]);
export const delegationStatusEnum = pgEnum('delegation_status', ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED']);

// §1.2 Subscriptions
// v3.2: StoreTier simplified to 5 values (removed BASIC, PREMIUM, ELITE; added POWER)
export const storeTierEnum = pgEnum('store_tier', ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE']);
// v3.2: ListerTier simplified to 4 values (removed PLUS, POWER, MAX, ENTERPRISE)
export const listerTierEnum = pgEnum('lister_tier', ['NONE', 'FREE', 'LITE', 'PRO']);
// v3.2: FinanceTier simplified to 2 values
export const financeTierEnum = pgEnum('finance_tier', ['FREE', 'PRO']);
export const bundleTierEnum = pgEnum('bundle_tier', ['NONE', 'STARTER', 'PRO', 'POWER']);
export const performanceBandEnum = pgEnum('performance_band', ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER', 'SUSPENDED']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING', 'PENDING']);
export const creditTypeEnum = pgEnum('credit_type', ['MONTHLY', 'OVERAGE', 'BONUS']);

// §1.3 Listings
export const listingStatusEnum = pgEnum('listing_status', ['DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'REMOVED', 'RESERVED']);
export const listingConditionEnum = pgEnum('listing_condition', [
  'NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'
]);
export const enforcementStateEnum = pgEnum('enforcement_state', ['CLEAR', 'FLAGGED', 'SUPPRESSED', 'REMOVED']);

// §1.4 Commerce
export const cartStatusEnum = pgEnum('cart_status', ['ACTIVE', 'CONVERTED', 'EXPIRED', 'ABANDONED']);
export const offerStatusEnum = pgEnum('offer_status', ['PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN', 'CANCELED']);
export const offerTypeEnum = pgEnum('offer_type', ['BEST_OFFER', 'WATCHER_OFFER', 'BUNDLE']);
export const orderStatusEnum = pgEnum('order_status', [
  'CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT',
  'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED'
]);
export const cancelInitiatorEnum = pgEnum('cancel_initiator', ['BUYER', 'SELLER', 'SYSTEM', 'ADMIN']);

// §1.5 Shipping
export const fulfillmentTypeEnum = pgEnum('fulfillment_type', ['SHIP_ONLY', 'LOCAL_ONLY', 'SHIP_AND_LOCAL']);
export const shipmentStatusEnum = pgEnum('shipment_status', [
  'PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'FAILED', 'RETURNED',
  'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER'
]);
export const combinedShippingModeEnum = pgEnum('combined_shipping_mode', [
  'NONE', 'FLAT', 'PER_ADDITIONAL', 'AUTO_DISCOUNT', 'QUOTED'
]);
export const localTransactionStatusEnum = pgEnum('local_transaction_status', [
  'SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN', 'BOTH_CHECKED_IN',
  'RECEIPT_CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED',
  'ADJUSTMENT_PENDING', 'RESCHEDULE_PENDING'
]);
export const confirmationModeEnum = pgEnum('confirmation_mode', [
  'QR_ONLINE', 'QR_DUAL_OFFLINE', 'CODE_ONLINE', 'CODE_DUAL_OFFLINE'
]);

// §1.3 Listings (Authentication)
export const authenticationStatusEnum = pgEnum('authentication_status', [
  'NONE', 'SELLER_VERIFIED',
  'AI_PENDING', 'AI_AUTHENTICATED', 'AI_INCONCLUSIVE', 'AI_COUNTERFEIT',
  'EXPERT_PENDING', 'EXPERT_AUTHENTICATED', 'EXPERT_COUNTERFEIT',
  'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED'
]);

// §1.6 Returns & Disputes
export const returnStatusEnum = pgEnum('return_status', [
  'PENDING_SELLER', 'APPROVED', 'DECLINED', 'PARTIAL_OFFERED',
  'BUYER_ACCEPTS_PARTIAL', 'BUYER_DECLINES_PARTIAL',
  'LABEL_GENERATED', 'SHIPPED', 'DELIVERED',
  'REFUND_ISSUED', 'CONDITION_DISPUTE', 'BUYER_ACCEPTS', 'ESCALATED', 'CLOSED'
]);
export const returnReasonEnum = pgEnum('return_reason', ['INAD', 'DAMAGED', 'INR', 'COUNTERFEIT', 'REMORSE', 'WRONG_ITEM']);
export const returnFaultEnum = pgEnum('return_fault', ['SELLER', 'BUYER', 'CARRIER', 'PLATFORM']);
export const returnReasonBucketEnum = pgEnum('return_reason_bucket', [
  'SELLER_FAULT',
  'BUYER_REMORSE',
  'PLATFORM_CARRIER_FAULT',
  'EDGE_CONDITIONAL',
]);
export const disputeStatusEnum = pgEnum('dispute_status', [
  'OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'APPEALED', 'APPEAL_RESOLVED', 'CLOSED'
]);
// claim_type matches migration 0000 + canonical Schema Spec §1.6. WRONG_ITEM is a
// return_reason only; in buyer-protection.ts it maps → INAD for claim type storage.
export const claimTypeEnum = pgEnum('claim_type', ['INR', 'INAD', 'DAMAGED', 'COUNTERFEIT', 'REMORSE']);

// §1.7 Reviews
export const reviewStatusEnum = pgEnum('review_status', ['PENDING', 'APPROVED', 'FLAGGED', 'REMOVED']);
// buyerQualityTierEnum REMOVED — Decision #142. Replaced by buyer trust signals.

// §1.8 Messaging & Notifications
export const conversationStatusEnum = pgEnum('conversation_status', ['OPEN', 'READ_ONLY', 'ARCHIVED']);
export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'PUSH', 'IN_APP', 'SMS']);
export const notificationPriorityEnum = pgEnum('notification_priority', ['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);

// §1.9 Finance
// v3.2: Transaction Fee (TF) — progressive brackets replace old category-based fees
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'ORDER_PAYMENT_CAPTURED', 'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE',
  'REFUND_FULL', 'REFUND_PARTIAL', 'SELLER_ADJUSTMENT',
  'REFUND_TF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL',
  'CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE',
  'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND',
  'INSERTION_FEE', 'INSERTION_FEE_WAIVER',
  'SUBSCRIPTION_CHARGE', 'SUBSCRIPTION_CREDIT', 'OVERAGE_CHARGE',
  'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED',
  'RESERVE_HOLD', 'RESERVE_RELEASE',
  'MANUAL_CREDIT', 'MANUAL_DEBIT', 'PLATFORM_ABSORBED_COST',
  'AUTH_FEE_BUYER', 'AUTH_FEE_SELLER', 'AUTH_FEE_REFUND',
  'LOCAL_TRANSACTION_FEE', 'FINANCE_SUBSCRIPTION_CHARGE',
  'BUYER_REFERRAL_CREDIT_ISSUED', 'BUYER_REFERRAL_CREDIT_REDEEMED',
  'AFFILIATE_COMMISSION_PAYOUT',
  'CROSSLISTER_SALE_REVENUE', 'CROSSLISTER_PLATFORM_FEE',
  'LOCAL_FRAUD_REVERSAL', 'LOCAL_PRICE_ADJUSTMENT',
  'LOCAL_CASH_SALE_REVENUE',  // §8/A16 Cash local sale — INFORMATIONAL ONLY, no sellerBalance update
  'BOOST_CREDIT_ISSUED'  // §5.4 Seller Score Canonical — monthly performance reward credit
]);
export const ledgerEntryStatusEnum = pgEnum('ledger_entry_status', ['PENDING', 'POSTED', 'REVERSED']);
export const payoutStatusEnum = pgEnum('payout_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED']);
export const payoutBatchStatusEnum = pgEnum('payout_batch_status', ['CREATED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED']);
export const feeBucketEnum = pgEnum('fee_bucket', ['ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY']);

// §1.10 Crosslister
export const channelEnum = pgEnum('channel', [
  'TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL', 'WHATNOT', 'SHOPIFY', 'VESTIAIRE'
]);
export const pollTierEnum = pgEnum('poll_tier', ['HOT', 'WARM', 'COLD', 'LONGTAIL']);
export const authMethodEnum = pgEnum('auth_method', ['OAUTH', 'API_KEY', 'SESSION']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'PAUSED', 'REVOKED', 'ERROR', 'REAUTHENTICATION_REQUIRED']);
export const channelListingStatusEnum = pgEnum('channel_listing_status', [
  'DRAFT', 'PUBLISHING', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'DELISTING', 'DELISTED', 'ERROR', 'ORPHANED', 'UNMANAGED'
]);
export const publishJobStatusEnum = pgEnum('publish_job_status', ['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED']);
export const publishJobTypeEnum = pgEnum('publish_job_type', ['CREATE', 'UPDATE', 'DELIST', 'RELIST', 'SYNC', 'VERIFY']);
export const importBatchStatusEnum = pgEnum('import_batch_status', [
  'CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED'
]);

// §1.11 Helpdesk & KB
export const caseTypeEnum = pgEnum('case_type', [
  'SUPPORT', 'ORDER', 'RETURN', 'DISPUTE', 'CHARGEBACK', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM'
]);
export const caseStatusEnum = pgEnum('case_status', [
  'NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED'
]);
export const casePriorityEnum = pgEnum('case_priority', ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']);
export const caseChannelEnum = pgEnum('case_channel', ['WEB', 'EMAIL', 'SYSTEM', 'INTERNAL']);
export const caseMessageDirectionEnum = pgEnum('case_message_direction', ['INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM']);
export const caseMessageDeliveryStatusEnum = pgEnum('case_message_delivery_status', ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED']);
export const kbArticleStatusEnum = pgEnum('kb_article_status', ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);
export const kbAudienceEnum = pgEnum('kb_audience', ['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY']);
export const kbBodyFormatEnum = pgEnum('kb_body_format', ['MARKDOWN', 'HTML', 'RICHTEXT']);

// §1.12 Promotions & Infrastructure
export const promotionTypeEnum = pgEnum('promotion_type', ['PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT']);
export const promotionScopeEnum = pgEnum('promotion_scope', ['STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS']);
export const auditSeverityEnum = pgEnum('audit_severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const featureFlagTypeEnum = pgEnum('feature_flag_type', ['BOOLEAN', 'PERCENTAGE', 'TARGETED']);

// §1.12.1 Module System
export const moduleStateEnum = pgEnum('module_state', ['ENABLED', 'DISABLED', 'BETA', 'DEPRECATED']);

// §1.13 Provider System
export const providerAdapterSourceEnum = pgEnum('provider_adapter_source', ['BUILT_IN', 'HTTP_CUSTOM']);
export const providerServiceTypeEnum = pgEnum('provider_service_type', [
  'STORAGE', 'EMAIL', 'SEARCH', 'SMS', 'PUSH', 'PAYMENTS', 'SHIPPING', 'REALTIME', 'CACHE', 'CROSSLISTER'
]);
export const providerInstanceStatusEnum = pgEnum('provider_instance_status', ['ACTIVE', 'DISABLED', 'TESTING']);

// §1.14 Affiliates & Referrals
export const affiliateTierEnum = pgEnum('affiliate_tier', ['COMMUNITY', 'INFLUENCER']);
export const affiliateStatusEnum = pgEnum('affiliate_status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED']);
export const referralStatusEnum = pgEnum('referral_status', ['CLICKED', 'SIGNED_UP', 'TRIALING', 'CONVERTED', 'CHURNED']);
export const promoCodeTypeEnum = pgEnum('promo_code_type', ['AFFILIATE', 'PLATFORM']);
export const promoDiscountTypeEnum = pgEnum('promo_discount_type', ['PERCENTAGE', 'FIXED']);
export const commissionStatusEnum = pgEnum('commission_status', ['PENDING', 'PAYABLE', 'PAID', 'REVERSED']);
export const buyerReferralStatusEnum = pgEnum('buyer_referral_status', ['PENDING', 'SIGNED_UP', 'REDEEMED', 'EXPIRED']);

// §24.5 Live Sessions (Design Only)
export const liveSessionStatusEnum = pgEnum('live_session_status', ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']);

// §1.12.2 Local Fraud Detection (G2.15)
export const localFraudFlagSeverityEnum = pgEnum('local_fraud_flag_severity', [
  'CONFIRMED',       // Automatic — sold item while escrowed
  'STRONG_SIGNAL',   // Duplicate listing, relist after no-show
  'MANUAL_REVIEW',   // Buyer-reported fraud claim
]);

export const localFraudFlagStatusEnum = pgEnum('local_fraud_flag_status', [
  'OPEN',            // Awaiting staff review
  'CONFIRMED',       // Staff confirmed fraud — consequences applied
  'DISMISSED',       // Staff dismissed as false positive
]);

// §1.15 Personalization
export const interestSourceEnum = pgEnum('interest_source', [
  'EXPLICIT',
  'PURCHASE',
  'WATCHLIST',
  'CLICK',
  'SEARCH',
]);

// §1.17 Enforcement & Moderation (G4)
export const contentReportReasonEnum = pgEnum('content_report_reason', [
  'COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY',
  'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE',
  'SHILL_REVIEWS', 'OTHER',
]);
export const contentReportStatusEnum = pgEnum('content_report_status', [
  'PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED',
]);
export const contentReportTargetEnum = pgEnum('content_report_target', [
  'LISTING', 'REVIEW', 'MESSAGE', 'USER',
]);
export const enforcementActionTypeEnum = pgEnum('enforcement_action_type', [
  'COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL',
  'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION',
  'ACCOUNT_BAN',
]);
export const enforcementActionStatusEnum = pgEnum('enforcement_action_status', [
  'ACTIVE', 'EXPIRED', 'LIFTED', 'APPEALED', 'APPEAL_APPROVED',
]);
export const enforcementTriggerEnum = pgEnum('enforcement_trigger', [
  'SCORE_BASED', 'POLICY_VIOLATION', 'CONTENT_REPORT', 'ADMIN_MANUAL', 'SYSTEM_AUTO',
]);

// §1.18 Identity Verification (G6)
export const verificationLevelEnum = pgEnum('verification_level', [
  'BASIC',      // Email verified + phone verified
  'TAX',        // SSN/EIN + legal name + address (handled by G5 taxInfo)
  'ENHANCED',   // Government-issued photo ID + selfie match (Stripe Identity)
  'CATEGORY',   // Additional credentials per category (future)
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'NOT_REQUIRED', // No verification needed
  'PENDING',      // Verification submitted, awaiting result
  'VERIFIED',     // Successfully verified
  'FAILED',       // Verification failed (retryable)
  'EXPIRED',      // Enhanced verification expired after N months
]);

// §1.15 Newsletter
export const newsletterSourceEnum = pgEnum('newsletter_source', ['HOMEPAGE_SECTION', 'HOMEPAGE_FOOTER']);

// §1.16 Local Reliability (G2.8 — Decision #114)
export const localReliabilityEventTypeEnum = pgEnum('local_reliability_event_type', [
  'BUYER_CANCEL_GRACEFUL',
  'BUYER_CANCEL_LATE',
  'BUYER_CANCEL_SAMEDAY',
  'BUYER_NOSHOW',
  'SELLER_CANCEL_GRACEFUL',
  'SELLER_CANCEL_LATE',
  'SELLER_CANCEL_SAMEDAY',
  'SELLER_NOSHOW',
  'SELLER_DARK',
  'RESCHEDULE_EXCESS',
]);
