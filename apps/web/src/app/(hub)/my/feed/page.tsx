import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getForYouFeed } from '@/lib/queries/feed';
import { FeedPageContent } from '@/components/pages/feed/feed-page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'For You | Twicely' };
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const feedData = await getForYouFeed(session.user.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">For You</h1>
        <p className="text-muted-foreground mt-1">
          Listings personalized based on your interests and the sellers you follow
        </p>
      </div>

      <FeedPageContent feedData={feedData} />
    </div>
  );
}
