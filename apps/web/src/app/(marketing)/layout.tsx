import { MarketplaceHeader } from '@/components/shared/marketplace-header';
import { MarketplaceFooter } from '@/components/shared/marketplace-footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      <MarketplaceHeader />
      <main className="flex-1">{children}</main>
      <MarketplaceFooter />
    </div>
  );
}
