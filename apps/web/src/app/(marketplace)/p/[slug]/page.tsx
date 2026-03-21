import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getInfluencerLandingData } from '@/lib/queries/affiliate-landing';
import { InfluencerLanding } from '@/components/affiliate/influencer-landing';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getInfluencerLandingData(slug);

  if (!data) {
    return { title: 'Not Found | Twicely' };
  }

  const name = data.displayName ?? data.username ?? data.referralCode;
  const description = data.bio
    ? data.bio.slice(0, 160)
    : `Join Twicely with ${name}'s referral link and start buying and selling secondhand.`;

  return {
    title: `${name} on Twicely | Join with ${data.referralCode}`,
    description,
    openGraph: data.avatarUrl
      ? { images: [{ url: data.avatarUrl }] }
      : undefined,
  };
}

export default async function InfluencerLandingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const data = await getInfluencerLandingData(slug);

  if (!data) {
    notFound();
  }

  return <InfluencerLanding data={data} searchParams={resolvedSearchParams} />;
}
