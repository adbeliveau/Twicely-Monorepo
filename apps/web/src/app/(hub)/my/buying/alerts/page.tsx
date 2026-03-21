import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getCategoryAlerts } from '@/lib/queries/category-alerts';
import { getUserPriceAlerts } from '@/lib/queries/price-alerts';
import { AlertsList } from '@/components/pages/buying/alerts-list';
import { PriceAlertsList } from '@/components/pages/buying/price-alerts-list';
import { Bell, Tag, FolderSearch } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@twicely/ui/tabs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Alerts | Twicely',
};

export default async function AlertsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/buying/alerts');
  }

  const [categoryAlerts, priceAlerts] = await Promise.all([
    getCategoryAlerts(session.user.id),
    getUserPriceAlerts(session.user.id),
  ]);

  const totalAlerts = categoryAlerts.length + priceAlerts.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Alerts</h1>
        <p className="text-muted-foreground">
          Get notified about price drops and new listings
        </p>
      </div>

      {totalAlerts === 0 ? (
        <div className="text-center py-12 rounded-lg border bg-white">
          <Bell className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No alerts set up yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Set price alerts on listings or save searches to get notified
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
            >
              Browse Listings
            </Link>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="price" className="w-full">
          <TabsList>
            <TabsTrigger value="price" className="gap-2">
              <Tag className="h-4 w-4" />
              Price Alerts ({priceAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="category" className="gap-2">
              <FolderSearch className="h-4 w-4" />
              Category Alerts ({categoryAlerts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="price" className="mt-4">
            {priceAlerts.length === 0 ? (
              <div className="text-center py-8 rounded-lg border bg-white">
                <Tag className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  No price alerts yet. Set alerts on listings to track price drops.
                </p>
              </div>
            ) : (
              <PriceAlertsList alerts={priceAlerts} />
            )}
          </TabsContent>

          <TabsContent value="category" className="mt-4">
            {categoryAlerts.length === 0 ? (
              <div className="text-center py-8 rounded-lg border bg-white">
                <FolderSearch className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  No category alerts yet. Save a search to get notified of new listings.
                </p>
              </div>
            ) : (
              <AlertsList alerts={categoryAlerts} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
