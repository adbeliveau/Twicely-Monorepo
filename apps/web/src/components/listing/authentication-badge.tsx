import Link from 'next/link';
import { ShieldCheck, Clock, BadgeCheck } from 'lucide-react';

type AuthenticationBadgeProps = {
  authenticationStatus: string;
  certificateNumber?: string | null;
  isSellerVerified?: boolean;
};

export function AuthenticationBadge({
  authenticationStatus,
  certificateNumber,
  isSellerVerified,
}: AuthenticationBadgeProps) {
  if (authenticationStatus === 'EXPERT_AUTHENTICATED') {
    const verifyHref = certificateNumber ? `/verify/${certificateNumber}` : undefined;
    const badge = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <ShieldCheck className="h-3.5 w-3.5" />
        Expert Authenticated
      </span>
    );
    if (verifyHref) {
      return (
        <Link href={verifyHref} className="hover:opacity-80 transition-opacity" target="_blank">
          {badge}
        </Link>
      );
    }
    return badge;
  }

  if (authenticationStatus === 'AI_AUTHENTICATED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
        <ShieldCheck className="h-3.5 w-3.5" />
        AI Authenticated
      </span>
    );
  }

  if (authenticationStatus === 'EXPERT_PENDING') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        <Clock className="h-3.5 w-3.5" />
        Authentication Pending
      </span>
    );
  }

  if (authenticationStatus === 'SELLER_VERIFIED' || isSellerVerified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
        <BadgeCheck className="h-3.5 w-3.5" />
        Verified Seller
      </span>
    );
  }

  // NONE or unknown — render nothing
  return null;
}
