import { BadgeCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

type VerifiedSellerSectionProps = {
  isAuthenticatedSeller: boolean;
};

export function VerifiedSellerSection({ isAuthenticatedSeller }: VerifiedSellerSectionProps) {
  if (isAuthenticatedSeller) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-5 w-5 text-indigo-600" />
            Verified Seller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account has been verified by Twicely. The Verified Seller badge appears on your
            profile and listings, signalling to buyers that your sourcing and credentials have been
            reviewed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
          Become a Verified Seller
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Verified Sellers have completed Twicely&apos;s credential review. The badge helps buyers
          feel confident purchasing from you and can increase conversion rates.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Free — no cost to apply</li>
          <li>Displayed on your seller profile and all your listings</li>
          <li>Requires sourcing documentation review by Twicely staff</li>
        </ul>
        <p className="text-sm font-medium text-foreground">
          To apply, contact Twicely support and request a Verified Seller review.
        </p>
      </CardContent>
    </Card>
  );
}
