'use client';

import { useRouter } from 'next/navigation';
import { signOut, useSession } from '@twicely/auth/client';

export default function MyPage() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
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

      <button
        onClick={handleSignOut}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
      >
        Sign Out
      </button>
    </div>
  );
}
