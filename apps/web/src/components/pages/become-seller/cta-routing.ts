/**
 * CTA routing logic for the Become Seller page.
 * Pure function — no DB calls, no auth.
 * The page RSC resolves session and seller status, then passes to this function.
 */

export interface CtaRoutingInput {
  isAuthenticated: boolean;
  isSeller: boolean;
  sellerType: 'PERSONAL' | 'BUSINESS' | null;
}

export interface CtaRoutingResult {
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  isSeller: boolean;
  isBusinessSeller: boolean;
  showUpgradeCta: boolean;
}

export function resolveCtaRouting(input: CtaRoutingInput): CtaRoutingResult {
  if (!input.isAuthenticated) {
    return {
      ctaLabel: 'Sign up and start selling',
      ctaHref: '/auth/signup',
      secondaryCtaLabel: 'Log in',
      secondaryCtaHref: '/auth/login',
      isSeller: false,
      isBusinessSeller: false,
      showUpgradeCta: false,
    };
  }

  if (!input.isSeller) {
    return {
      ctaLabel: 'Create your first listing',
      ctaHref: '/my/selling/listings/new',
      isSeller: false,
      isBusinessSeller: false,
      showUpgradeCta: false,
    };
  }

  if (input.sellerType === 'BUSINESS') {
    return {
      ctaLabel: 'Go to selling dashboard',
      ctaHref: '/my/selling',
      isSeller: true,
      isBusinessSeller: true,
      showUpgradeCta: true,
    };
  }

  return {
    ctaLabel: 'Go to my listings',
    ctaHref: '/my/selling/listings',
    isSeller: true,
    isBusinessSeller: false,
    showUpgradeCta: false,
  };
}
