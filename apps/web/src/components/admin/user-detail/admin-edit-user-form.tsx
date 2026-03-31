'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminEditUserAction } from '@/lib/actions/admin-users-management';

interface Props {
  userId: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
}

export function AdminEditUserForm({
  userId, name: initName, displayName: initDisplay,
  username: initUsername, email, phone: initPhone,
  marketingOptIn: initMarketing,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initName);
  const [displayName, setDisplayName] = useState(initDisplay ?? '');
  const [username, setUsername] = useState(initUsername ?? '');
  const [phone, setPhone] = useState(initPhone ?? '');
  const [marketingOptIn, setMarketingOptIn] = useState(initMarketing);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await adminEditUserAction({
        userId,
        name,
        displayName: displayName || null,
        username: username || null,
        phone: phone || null,
        marketingOptIn,
      });
      if (res.error) {
        setError(res.error);
      } else {
        router.push(`/usr/${userId}`);
      }
    });
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50';
  const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>Full Name *</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)}
          required className={inputClass} disabled={pending} />
      </div>

      <div>
        <label htmlFor="displayName" className={labelClass}>Display Name</label>
        <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass} disabled={pending} />
      </div>

      <div>
        <label htmlFor="username" className={labelClass}>Username</label>
        <input id="username" value={username} onChange={(e) => setUsername(e.target.value)}
          pattern="^[a-zA-Z0-9_]{3,30}$" className={inputClass} disabled={pending} />
        <p className="mt-1 text-xs text-gray-500">Letters, numbers, underscores. 3-30 characters.</p>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" value={email} disabled
          className={`${inputClass} bg-gray-50 dark:bg-gray-900`} />
        <p className="mt-1 text-xs text-gray-500">Email cannot be changed from admin. User must update it themselves.</p>
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>Phone</label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)}
          className={inputClass} disabled={pending} />
      </div>

      <div className="flex items-center gap-3">
        <input id="marketingOptIn" type="checkbox" checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)} disabled={pending}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600" />
        <label htmlFor="marketingOptIn" className="text-sm text-gray-700 dark:text-gray-300">
          Marketing opt-in
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.push(`/usr/${userId}`)}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}
