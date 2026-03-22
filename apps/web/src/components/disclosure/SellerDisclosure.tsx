/**
 * Seller Relationship Disclosure
 * Shows when a seller has a relationship with the platform
 *
 * FTC Compliant: Discloses employee, partner, and other platform relationships.
 */

type DisclosureType = "employee" | "family" | "demo" | "partner" | "affiliate" | "investor";

type SellerDisclosureProps = {
  // Accept string from database, will normalize to known types
  type?: DisclosureType | string | null;
  relationship?: DisclosureType | string | null; // Alias for type
  className?: string;
};

export function SellerDisclosure({ type, relationship, className = "" }: SellerDisclosureProps) {
  // Use relationship if type not provided (allows both prop names)
  const disclosureType = type || relationship;

  if (!disclosureType) return null;

  const getConfig = () => {
    switch (disclosureType) {
      case "employee":
        return {
          label: "Sold by Twicely Team",
          bgClass: "bg-purple-100 dark:bg-purple-900/20",
          textClass: "text-purple-800 dark:text-purple-400",
        };
      case "family":
        return {
          label: "Sold by Twicely Family",
          bgClass: "bg-pink-100 dark:bg-pink-900/20",
          textClass: "text-pink-800 dark:text-pink-400",
        };
      case "demo":
        return {
          label: "Demo Listing",
          bgClass: "bg-gray-100 dark:bg-gray-800",
          textClass: "text-gray-700 dark:text-gray-300",
        };
      case "partner":
        return {
          label: "Partner Seller",
          bgClass: "bg-blue-100 dark:bg-blue-900/20",
          textClass: "text-blue-800 dark:text-blue-400",
        };
      case "affiliate":
        return {
          label: "Affiliate Partner",
          bgClass: "bg-teal-100 dark:bg-teal-900/20",
          textClass: "text-teal-800 dark:text-teal-400",
        };
      case "investor":
        return {
          label: "Twicely Investor",
          bgClass: "bg-amber-100 dark:bg-amber-900/20",
          textClass: "text-amber-800 dark:text-amber-400",
        };
      default:
        // Handle unknown types gracefully
        return {
          label: "Platform Affiliated",
          bgClass: "bg-gray-100 dark:bg-gray-800",
          textClass: "text-gray-700 dark:text-gray-300",
        };
    }
  };

  const config = getConfig();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass} ${className}`}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {config.label}
    </span>
  );
}
