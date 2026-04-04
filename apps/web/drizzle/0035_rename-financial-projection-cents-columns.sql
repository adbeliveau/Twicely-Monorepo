-- Rename financial_projection monetary columns to include _cents suffix
-- for consistency with the codebase convention (integer cents naming).
-- Table has zero runtime consumers — safe to rename.

ALTER TABLE "financial_projection"
  RENAME COLUMN "projected_revenue_30d" TO "projected_revenue_30d_cents";

ALTER TABLE "financial_projection"
  RENAME COLUMN "projected_expenses_30d" TO "projected_expenses_30d_cents";

ALTER TABLE "financial_projection"
  RENAME COLUMN "projected_profit_30d" TO "projected_profit_30d_cents";

ALTER TABLE "financial_projection"
  RENAME COLUMN "avg_sale_price_90d" TO "avg_sale_price_90d_cents";

ALTER TABLE "financial_projection"
  RENAME COLUMN "break_even_revenue" TO "break_even_revenue_cents";
