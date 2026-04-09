/**
 * Projection types for the Finance Intelligence Layer.
 * Financial Center Canonical §6 — nightly-computed metrics.
 */

/** An order record pre-fetched for projection computation. */
export interface OrderSummary {
  id: string;
  totalCents: number;
  tfFeesCents: number;
  stripeFeesCents: number;
  shippingCostsCents: number;
  cogsCents: number;               // sum of COGS for items in this order (0 if unknown)
  completedAt: Date;
  listingActivatedAt: Date | null; // for avgDaysToSell
  categoryId: string | null;
}

/** An expense record pre-fetched for projection computation. */
export interface ExpenseSummary {
  id: string;
  amountCents: number;
  category: string;
  expenseDate: Date;
}

/** A listing record pre-fetched for projection computation. */
export interface ListingSummary {
  id: string;
  priceCents: number | null;
  cogsCents: number | null;
  status: string;
  activatedAt: Date | null;
}

/** Input to all projection compute functions. */
export interface ProjectionInput {
  sellerProfileId: string;
  accountCreatedAt: Date;
  /** Up to 12 months of completed orders, sorted ascending by completedAt. */
  orders: OrderSummary[];
  /** Up to 12 months of expenses, sorted ascending by expenseDate. */
  expenses: ExpenseSummary[];
  /** All currently ACTIVE listings. */
  activeListings: ListingSummary[];
}

/** Five-component health score breakdown. */
export interface HealthScoreBreakdown {
  profitMarginTrend: number;   // 0-100, weight 25%
  expenseRatio: number;        // 0-100, weight 20%
  sellThroughVelocity: number; // 0-100, weight 20%
  inventoryAge: number;        // 0-100, weight 20%
  revenueGrowth: number;       // 0-100, weight 15%
}

/** Day-of-week + monthly revenue grouping. */
export interface PerformingPeriods {
  /** 0 = Sunday … 6 = Saturday, value = avg revenue in cents. */
  dayOfWeek: number[];
  /** ISO month strings mapped to total revenue cents. */
  monthlyRevenue: Array<{ month: string; revenueCents: number }>;
}

/** Full set of metrics stored in financialProjection table plus derived JSON fields. */
export interface ProjectionOutput {
  projectedRevenue30dCents: number | null;
  projectedExpenses30dCents: number | null;
  projectedProfit30dCents: number | null;
  sellThroughRate90d: number | null;          // basis points
  avgSalePrice90dCents: number | null;
  effectiveFeeRate90d: number | null;         // basis points
  avgDaysToSell90d: number | null;
  breakEvenRevenueCents: number | null;
  breakEvenOrders: number | null;
  healthScore: number | null;                 // 0-100
  healthScoreBreakdownJson: HealthScoreBreakdown | null;
  inventoryTurnsPerMonth: number | null;      // basis points
  performingPeriodsJson: PerformingPeriods | null;
  dataQualityScore: number;                   // 0-100
}
