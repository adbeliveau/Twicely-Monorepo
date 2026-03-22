/**
 * Seller Response Badge
 * Clearly marks when a response is from the seller (not the buyer)
 */

type SellerResponseBadgeProps = {
  className?: string;
};

export function SellerResponseBadge({ className = "" }: SellerResponseBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 ${className}`}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
        />
      </svg>
      Seller Response
    </span>
  );
}
