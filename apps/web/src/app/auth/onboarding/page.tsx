import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getInterestTags, getUserExplicitInterests } from '@/lib/queries/personalization';
import { InterestPicker } from '@/components/onboarding/interest-picker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Welcome to Twicely',
  robots: 'noindex',
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/auth/onboarding');
  }

  const existingSlugs = await getUserExplicitInterests(session.user.id);
  if (existingSlugs.length > 0) {
    redirect('/');
  }

  const tags = await getInterestTags();

  return <InterestPicker tags={tags} />;
}
