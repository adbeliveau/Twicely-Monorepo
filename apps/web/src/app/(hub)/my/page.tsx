import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getBuyerTrustSignals } from '@/lib/queries/trust-metrics';
import { SignOutButton } from './_components/sign-out-button';
import { Shield, ShoppingBag, CheckCircle } from 'lucide-react';
import { formatDate } from '@twicely/utils/format';

export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const trustSignals = await getBuyerTrustSignals(session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Welcome back!</h2>
        <p className="text-gray-600">
          {session.user.name ? `Hello, ${session.user.name}` : 'Hello!'}
        </p>
      </div>

      {/* Buyer Trust Signals (Decision #142) */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Your Buyer Profile</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
          <div className="flex items-start gap-2">
            <ShoppingBag className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-500">Completed Purchases</p>
              <p className="font-semibold text-gray-900">{trustSignals.completedPurchases}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-500">Member Since</p>
              <p className="font-semibold text-gray-900">{formatDate(trustSignals.memberSince)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-500">Verified</p>
              <p className="font-semibold text-gray-900">{trustSignals.verified ? 'Yes' : 'No'}</p>
            </div>
          </div>
          {trustSignals.returns90d > 0 && (
            <div>
              <p className="text-gray-500">Returns (90d)</p>
              <p className="font-semibold text-gray-900">{trustSignals.returns90d}</p>
            </div>
          )}
          {trustSignals.disputes90d > 0 && (
            <div>
              <p className="text-gray-500">Disputes (90d)</p>
              <p className="font-semibold text-gray-900">{trustSignals.disputes90d}</p>
            </div>
          )}
        </div>
      </div>

      <SignOutButton />
    </div>
  );
}
