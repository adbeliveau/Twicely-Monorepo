/**
 * Notification template types — TemplateKey union, TemplateDef interface, and channel/priority enums.
 * Split from templates.ts to keep both files under the 300-line limit.
 */

export type TemplateKey =
  | 'offer.declined' | 'offer.accepted' | 'offer.received' | 'offer.countered' | 'offer.expired'
  | 'order.confirmed' | 'order.shipped' | 'order.delivered' | 'order.canceled' | 'order.refunded'
  | 'watchlist.price_drop'
  | 'watchlist.watcher_offer'
  | 'price_alert.triggered'
  | 'price_alert.back_in_stock'
  | 'search.new_match'
  | 'subscription.trial_ending'
  | 'subscription.trial_expired'
  | 'subscription.payment_failed'
  | 'return.requested' | 'return.approved' | 'return.declined'
  | 'return.shipped' | 'return.received' | 'return.auto_approved'
  | 'dispute.opened'
  | 'dispute.resolved'
  | 'protection.claim_submitted'
  | 'shipping.exception'
  | 'shipping_quote.requested'
  | 'shipping_quote.received'
  | 'shipping_quote.accepted'
  | 'shipping_quote.disputed'
  | 'shipping_quote.penalty_applied'
  | 'shipping_quote.deadline_missed'
  | 'qa.new_question'
  | 'qa.answer_received'
  | 'messaging.new_message'
  | 'import_completed'
  | 'crosslister.sale_detected'
  | 'crosslister.delist_failed'
  | 'crosslister.double_sell'
  | 'local.safety.nudge'
  | 'local.safety.escalated'
  | 'local.auto_cancel'
  | 'local.schedule.proposal'
  | 'local.schedule.accepted'
  | 'local.schedule.reminder_setup'
  | 'local.reschedule.proposal'
  | 'local.reschedule.accepted'
  | 'local.reschedule.declined'
  | 'local.cancel'
  | 'local.dayof.request'
  | 'local.dayof.confirmed'
  | 'local.dayof.expired'
  | 'local.dayof.expired_seller'
  | 'local.reminder.24hr' | 'local.reminder.1hr'
  | 'local.fraud.buyer_refund'
  | 'local.fraud.seller_flagged'
  | 'local.fraud.seller_banned'
  | 'local.fraud.seller_suspended'
  | 'affiliate.influencer_application_received'
  | 'affiliate.influencer_approved'
  | 'affiliate.influencer_rejected'
  | 'affiliate.payout_sent'
  | 'affiliate.payout_failed'
  | 'affiliate.fraud_warning'
  | 'affiliate.fraud_suspended'
  | 'affiliate.fraud_banned'
  | 'affiliate.suspension_lifted'
  | 'social.followed_seller_new_listing'
  | 'enforcement.coaching' | 'enforcement.warning' | 'enforcement.restriction' | 'enforcement.lifted'
  | 'enforcement.band_upgrade' | 'enforcement.band_downgrade'
  | 'enforcement.appeal_submitted' | 'enforcement.appeal_approved' | 'enforcement.appeal_denied'
  | 'tax.info_required'
  | 'tax.info_required_payout_blocked'
  | 'tax.form_1099k_ready'
  | 'tax.form_1099nec_ready'
  // KYC & Identity Verification — G6
  | 'kyc.verification_required'
  | 'kyc.verification_submitted'
  | 'kyc.verification_approved'
  | 'kyc.verification_failed'
  | 'kyc.verification_expired'
  // Privacy / Data — G6 + G8
  | 'privacy.data_export_ready'
  | 'privacy.deletion_started'
  | 'privacy.deletion_completed'
  // Cookie consent — G8.3
  | 'privacy.consent_changed'
  // Helpdesk & Support Cases — G9
  | 'helpdesk.case.created'
  | 'helpdesk.case.auto_reply'
  | 'helpdesk.case.agent_reply'
  | 'helpdesk.case.resolved'
  | 'helpdesk.case.closed'
  | 'helpdesk.case.reopened'
  | 'helpdesk.csat.request'
  | 'helpdesk.agent.assigned'
  | 'helpdesk.agent.sla_warning'
  | 'helpdesk.agent.sla_breach'
  | 'helpdesk.agent.mention'
  | 'helpdesk.case.watcher_update'
  | 'helpdesk.case.status_changed_user'
  | 'helpdesk.case.escalated_user'
  // Seller performance rewards — Seller Score Canonical §5.4
  | 'seller.boostCredit.issued'
  // Seller bank payouts — G10 / Stripe Connect
  | 'seller.payout.paid'
  | 'seller.payout.failed'
  // AI Authentication — G10.2
  | 'auth.ai.authenticated'
  | 'auth.ai.counterfeit'
  | 'auth.ai.inconclusive'
  // Accounting Sync — G10.3
  | 'accounting.sync.completed'
  | 'accounting.sync.failed';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type NotificationChannel = 'EMAIL' | 'IN_APP';

export interface TemplateDef {
  key: TemplateKey;
  name: string;
  category: string;
  priority: NotificationPriority;
  defaultChannels: NotificationChannel[];
  subjectTemplate: string;
  bodyTemplate: string;
}
