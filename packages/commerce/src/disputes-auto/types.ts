/**
 * Disputes Automation — Type definitions
 *
 * Types for the auto-resolution rule engine, SLA management,
 * evidence handling, escalation ladder, and resolution tracking.
 */

// ─── SLA ─────────────────────────────────────────────────────────────────────

export type SlaStage =
  | 'seller_response'
  | 'buyer_response'
  | 'platform_review'
  | 'supervisor_review'
  | 'final';

/** Maps SLA stage to the platform_settings key for its deadline hours. */
export const SLA_STAGE_SETTINGS_KEY: Record<Exclude<SlaStage, 'final'>, string> = {
  seller_response:    'disputes.sla.sellerResponseHours',
  buyer_response:     'disputes.sla.buyerResponseHours',
  platform_review:    'disputes.sla.platformReviewHours',
  supervisor_review:  'disputes.sla.supervisorReviewHours',
};

export const SLA_STAGE_DEFAULTS: Record<Exclude<SlaStage, 'final'>, number> = {
  seller_response:    48,
  buyer_response:     72,
  platform_review:    120,
  supervisor_review:  48,
};

// ─── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceType = 'tracking' | 'photo' | 'receipt' | 'communication' | 'other';

export const VALID_EVIDENCE_TYPES: ReadonlySet<string> = new Set<EvidenceType>([
  'tracking', 'photo', 'receipt', 'communication', 'other',
]);

export type SubmitterRole = 'buyer' | 'seller' | 'platform';

export interface SubmitEvidenceInput {
  disputeId: string;
  submittedBy: SubmitterRole;
  submitterId: string;
  evidenceType: EvidenceType;
  description?: string;
  storageKey?: string;
  metadata?: Record<string, unknown>;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'opened'
  | 'response'
  | 'evidence'
  | 'escalated'
  | 'resolved'
  | 'auto_action'
  | 'sla_breach'
  | 'appeal_filed'
  | 'appeal_resolved';

export type TimelineActorType = 'buyer' | 'seller' | 'platform' | 'system';

export interface AddTimelineEventInput {
  disputeId: string;
  eventType: TimelineEventType;
  actorType: TimelineActorType;
  actorId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// ─── Rule Engine ─────────────────────────────────────────────────────────────

export interface RuleConditions {
  deliveryConfirmed?: boolean;
  daysSinceDelivery?: number;
  hasTracking?: boolean;
  sellerResponded?: boolean;
  buyerResponded?: boolean;
  daysSinceOpen?: number;
  claimType?: string;
  orderTotalCentsMax?: number;
  buyerClaimCount90Days?: number;
  sellerScoreBand?: string;
  chargebackProbability?: number;
}

export type RuleAction =
  | 'close_buyer_favor'
  | 'close_seller_favor'
  | 'escalate'
  | 'refund_partial'
  | 'prevent_chargeback';

export interface RuleActionParams {
  refundPercent?: number;
  notifyBuyer?: boolean;
  notifySeller?: boolean;
  escalateTo?: number;
}

export type ResolutionBias = 'SELLER' | 'NEUTRAL' | 'BUYER';

export interface DisputeContext {
  disputeId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  claimType: string;
  status: string;
  orderTotalCents: number;
  createdAt: Date;
  daysSinceOpen: number;
  hasTracking: boolean;
  deliveryConfirmed: boolean;
  daysSinceDelivery: number | null;
  sellerResponded: boolean;
  buyerResponded: boolean;
  isAutoResolvable: boolean;
}

export interface EvaluationResult {
  shouldResolve: boolean;
  rule?: {
    id: string;
    name: string;
    action: RuleAction;
    actionParams: RuleActionParams;
    conditions: RuleConditions;
  };
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export type ResolutionOutcome = 'buyer_favor' | 'seller_favor' | 'split' | 'withdrawn';

export interface ResolveDisputeAutoInput {
  disputeId: string;
  outcome: ResolutionOutcome;
  reason: string;
  refundCents?: number;
  resolvedBy: 'auto' | 'staff' | 'system';
  resolvedById?: string;
  ruleId?: string;
}

export interface WaterfallResultSnapshot {
  recoveredFromAvailableCents: number;
  recoveredFromReservedCents: number;
  platformAbsorbedCents: number;
}

// ─── Escalation ──────────────────────────────────────────────────────────────

/**
 * Escalation levels:
 *   0 = Auto-resolution engine (initial)
 *   1 = Support agent
 *   2 = Supervisor
 *   3 = Platform decision (senior staff, final authority)
 */
export const MAX_ESCALATION_LEVEL = 3;

export interface EscalateDisputeInput {
  disputeId: string;
  actorType: TimelineActorType;
  actorId?: string;
  reason: string;
}

// ─── Rule CRUD ───────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  name: string;
  ruleType: string;
  priority: number;
  conditions: RuleConditions;
  action: RuleAction;
  actionParams?: RuleActionParams;
  staffId: string;
}

export interface UpdateRuleInput {
  name?: string;
  ruleType?: string;
  priority?: number;
  conditions?: RuleConditions;
  action?: RuleAction;
  actionParams?: RuleActionParams;
  isActive?: boolean;
}
