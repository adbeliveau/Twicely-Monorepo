'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from '@twicely/auth/client';

export default function MyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError('');
    try {
      await signOut();
      router.push('/auth/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      setIsSigningOut(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Welcome back!</h2>
        <p className="text-gray-600">
          {session?.user?.name ? `Hello, ${session.user.name}` : 'Hello!'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  );
}
