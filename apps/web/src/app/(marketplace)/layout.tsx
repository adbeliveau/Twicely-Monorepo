import { headers } from 'next/headers';
import { MarketplaceHeader } from '@/components/shared/marketplace-header';
import { MarketplaceFooter } from '@/components/shared/marketplace-footer';
import { MobileBottomNav } from '@/components/shared/mobile-bottom-nav';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { SkipNav } from '@/components/shared/skip-nav';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { auth } from '@twicely/auth/server';

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const consentRequired = await getPlatformSetting<boolean>(
    'gdpr.cookieConsentRequired',
    true
  );

  let isAuthenticated = false;
  let isEuVisitor = true; // conservative default: assume EU
  try {
    const reqHeaders = await headers();
    const betterAuthSession = await auth.api.getSession({ headers: reqHeaders });
    isAuthenticated = !!betterAuthSession;
    // Cloudflare CF-IPCountry header: EU/EEA country codes
    const cfCountry = reqHeaders.get('CF-IPCountry') ?? '';
    const EU_EEA_CODES = new Set([
      'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR',
      'HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT',
      'RO','SE','SI','SK','GB',
    ]);
    if (cfCountry && cfCountry !== 'XX') {
      isEuVisitor = EU_EEA_CODES.has(cfCountry);
    }
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      <SkipNav />
      <MarketplaceHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-16 md:pb-0">{children}</main>
      <MarketplaceFooter />
      <MobileBottomNav />
      <CookieConsentBanner
        consentRequired={consentRequired}
        isEuVisitor={isEuVisitor}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
