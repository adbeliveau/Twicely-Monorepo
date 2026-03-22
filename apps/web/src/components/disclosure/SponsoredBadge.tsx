/**
 * FTC Compliant Sponsored Badge
 * Displays "Sponsored" or "Ad" label for promoted/boosted listings
 * Must be clear and conspicuous per FTC guidelines
 */

type SponsoredBadgeProps = {
  variant?: "default" | "compact";
  className?: string;
};

export function SponsoredBadge({ variant = "default", className = "" }: SponsoredBadgeProps) {
  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-white ${className}`}
        title="This is a paid promotion"
      >
        Ad
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-white ${className}`}
      title="This is a paid promotion"
    >
      Sponsored
    </span>
  );
}
