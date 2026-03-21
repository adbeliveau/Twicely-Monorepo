import { Avatar, AvatarFallback, AvatarImage } from '@twicely/ui/avatar';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Instagram, Youtube, Link as LinkIcon } from 'lucide-react';
import type { InfluencerLandingData } from '@/lib/queries/affiliate-landing';

interface InfluencerLandingProps {
  data: InfluencerLandingData;
  searchParams?: Record<string, string>;
}

function getInitials(displayName: string | null, username: string | null): string {
  const name = displayName ?? username ?? '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function buildCtaHref(referralCode: string, searchParams?: Record<string, string>): string {
  const base = `/ref/${referralCode}`;
  if (!searchParams) return base;

  const utmEntries = Object.entries(searchParams).filter(([key]) =>
    key.startsWith('utm_'),
  );
  if (utmEntries.length === 0) return base;

  const qs = new URLSearchParams(
    utmEntries.map(([k, v]) => [k, v] as [string, string]),
  ).toString();
  return `${base}?${qs}`;
}

function formatDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'PERCENTAGE') {
    return `${Math.round(discountValue / 100)}% off`;
  }
  const dollars = Math.floor(discountValue / 100);
  const cents = discountValue % 100;
  if (cents === 0) {
    return `$${dollars} off`;
  }
  return `$${dollars}.${String(cents).padStart(2, '0')} off`;
}

function formatDuration(durationMonths: number): string {
  if (durationMonths === 1) return 'your first month';
  return `your first ${durationMonths} months`;
}

export function InfluencerLanding({ data, searchParams }: InfluencerLandingProps) {
  const initials = getInitials(data.displayName, data.username);
  const ctaHref = buildCtaHref(data.referralCode, searchParams);
  const headingName = data.displayName ?? data.username ?? data.referralCode;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 text-center">
        <Avatar className="h-24 w-24">
          {data.avatarUrl && (
            <AvatarImage src={data.avatarUrl} alt={headingName} />
          )}
          <AvatarFallback className="text-2xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{headingName}</h1>
          {data.username && data.displayName && (
            <p className="text-sm text-muted-foreground">@{data.username}</p>
          )}
        </div>
        {data.bio && (
          <p className="max-w-xl text-muted-foreground">{data.bio}</p>
        )}
      </section>

      {/* Social Links */}
      {data.socialLinks && (
        <section className="flex justify-center gap-3">
          {data.socialLinks.instagram && (
            <a
              href={data.socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <Button variant="outline" size="icon">
                <Instagram className="h-4 w-4" />
              </Button>
            </a>
          )}
          {data.socialLinks.youtube && (
            <a
              href={data.socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
            >
              <Button variant="outline" size="icon">
                <Youtube className="h-4 w-4" />
              </Button>
            </a>
          )}
          {data.socialLinks.tiktok && (
            <a
              href={data.socialLinks.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
            >
              <Button variant="outline" size="icon">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.75a8.19 8.19 0 0 0 4.78 1.52V6.82a4.85 4.85 0 0 1-1.01-.13z" />
                </svg>
              </Button>
            </a>
          )}
          {data.socialLinks.blog && (
            <a
              href={data.socialLinks.blog}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Blog"
            >
              <Button variant="outline" size="icon">
                <LinkIcon className="h-4 w-4" />
              </Button>
            </a>
          )}
        </section>
      )}

      {/* Value Prop */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Buy and sell secondhand on the marketplace built for resellers.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Cross-list your inventory to multiple platforms in seconds with the built-in crosslister.</li>
            <li>Shop with confidence — every purchase is covered by Twicely Buyer Protection.</li>
            <li>Keep more of what you earn with transparent, fair transaction fees.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Promo Codes */}
      {data.promoCodes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Exclusive offer{data.promoCodes.length > 1 ? 's' : ''} from {headingName}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.promoCodes.map((pc) => (
              <Card key={pc.code}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Promo code
                      </p>
                      <p className="text-xl font-bold font-mono tracking-widest">
                        {pc.code}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {formatDiscount(pc.discountType, pc.discountValue)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Valid for {formatDuration(pc.durationMonths)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="flex flex-col items-center gap-3 py-4">
        <a href={ctaHref}>
          <Button size="lg" className="px-10">
            Join Twicely with {headingName}&apos;s link
          </Button>
        </a>
        <a href="/" className="text-sm text-muted-foreground hover:underline">
          Already have an account? Browse the marketplace
        </a>
      </section>
    </div>
  );
}
