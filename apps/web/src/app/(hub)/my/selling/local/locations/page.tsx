import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getActiveSafeMeetupLocations } from '@/lib/queries/safe-meetup-locations';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { ChevronLeft, MapPin, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Meetup Locations | Twicely',
  robots: 'noindex',
};

export default async function LocalLocationsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/local/locations');
  }

  if (!session.isSeller && !session.delegationId) {
    redirect('/my');
  }

  const locations = await getActiveSafeMeetupLocations();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/my/selling/local"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Local Pickup
        </Link>
        <h1 className="text-2xl font-bold">Meetup Locations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-verified safe spots for in-person meetups
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Verified Safe Spots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These locations have been verified by Twicely as safe meeting points. Using a verified location
            is recommended for all in-person transactions.
          </p>
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No verified locations available yet.</p>
          ) : (
            <div className="space-y-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-start gap-3 rounded-lg border p-4"
                >
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{loc.name}</p>
                      <Badge variant="secondary" className="text-xs">{loc.type}</Badge>
                      {loc.verifiedSafe && (
                        <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {loc.address}, {loc.city}, {loc.state} {loc.zip}
                    </p>
                    {loc.meetupCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {loc.meetupCount} meetups completed here
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
