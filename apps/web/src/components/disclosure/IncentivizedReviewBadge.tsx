/**
 * FTC Compliant Incentivized Review Badge
 * Shows when a review was given in exchange for a discount, free product, etc.
 *
 * TODO: Requires schema change to add `isIncentivized` and `incentiveType` fields to Review model
 * This component is ready to use once those fields are added.
 */

type IncentiveType = "discount" | "free_product" | "gift_card" | "other";

type IncentivizedReviewBadgeProps = {
  incentiveType?: IncentiveType | string | null;
  className?: string;
};

export function IncentivizedReviewBadge({
  incentiveType = "other",
  className = "",
}: IncentivizedReviewBadgeProps) {
  const getLabel = () => {
    switch (incentiveType) {
      case "discount":
        return "Received Discount";
      case "free_product":
        return "Free Product";
      case "gift_card":
        return "Gift Card Incentive";
      default:
        return "Incentivized Review";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 ${className}`}
      title="This reviewer received an incentive for leaving a review"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
        />
      </svg>
      {getLabel()}
    </span>
  );
}
