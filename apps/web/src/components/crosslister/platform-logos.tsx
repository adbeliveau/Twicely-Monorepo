/**
 * Platform logo components — branded SVG marks for the 11 crosslister platforms.
 *
 * Each component renders a white glyph sized to fit inside a colored card.
 * Glyphs are stylized brand marks, not exact trademarks, to avoid IP concerns.
 * Swap in official SVGs later by replacing the component bodies.
 */

import type { ExternalChannel } from '@twicely/crosslister/types';

interface LogoProps {
  className?: string;
}

function EbayLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="30" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="700" fontStyle="italic">
        ebay
      </text>
    </svg>
  );
}

function EtsyLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="26" fontWeight="700">
        Etsy
      </text>
    </svg>
  );
}

function ShopifyLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="currentColor">
      <path d="M20 4 L30 8 L32 32 L20 36 L8 32 L10 8 Z M20 10 L16 12 L16 32 L24 32 L24 12 Z" />
    </svg>
  );
}

function WhatnotLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="currentColor">
      <path d="M18 4 L10 22 L18 22 L14 36 L30 16 L22 16 L26 4 Z" />
    </svg>
  );
}

function GrailedLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="28" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" letterSpacing="2">
        GRAILED
      </text>
    </svg>
  );
}

function DepopLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="30" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="900">
        depop
      </text>
    </svg>
  );
}

function MercariLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="30" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="700">
        mercari
      </text>
    </svg>
  );
}

function FBMarketplaceLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="currentColor">
      <circle cx="20" cy="20" r="18" />
      <path d="M22 14 L22 18 L26 18 L25 22 L22 22 L22 32 L18 32 L18 22 L15 22 L15 18 L18 18 L18 15 C18 12 20 10 23 10 L26 10 L26 14 Z" fill="#1877F2" />
    </svg>
  );
}

function PoshmarkLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="currentColor">
      <path d="M12 8 L12 32 L16 32 L16 24 L22 24 C27 24 30 21 30 16 C30 11 27 8 22 8 Z M16 12 L22 12 C25 12 26 14 26 16 C26 18 25 20 22 20 L16 20 Z" />
    </svg>
  );
}

function TheRealRealLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="28" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fontWeight="700" letterSpacing="1">
        The RealReal
      </text>
    </svg>
  );
}

function VestiaireLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
      <text x="50" y="22" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontWeight="700" letterSpacing="2">
        VESTIAIRE
      </text>
      <text x="50" y="34" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="400" letterSpacing="2">
        COLLECTIVE
      </text>
    </svg>
  );
}

export const PLATFORM_LOGOS: Record<ExternalChannel, React.ComponentType<LogoProps>> = {
  EBAY: EbayLogo,
  ETSY: EtsyLogo,
  SHOPIFY: ShopifyLogo,
  WHATNOT: WhatnotLogo,
  GRAILED: GrailedLogo,
  DEPOP: DepopLogo,
  MERCARI: MercariLogo,
  FB_MARKETPLACE: FBMarketplaceLogo,
  POSHMARK: PoshmarkLogo,
  THEREALREAL: TheRealRealLogo,
  VESTIAIRE: VestiaireLogo,
};
