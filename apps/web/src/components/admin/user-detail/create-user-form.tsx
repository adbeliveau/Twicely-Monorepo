'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUserAction } from '@/lib/actions/admin-users-management';

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: { name: string; email: string; username?: string } = { name: name.trim(), email: email.trim() };
    if (username.trim()) input.username = username.trim();

    startTransition(async () => {
      const res = await createUserAction(input);
      if (res.error) {
        setError(res.error);
      } else if (res.userId) {
        router.push(`/usr/${res.userId}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <label htmlFor="create-name" className="mb-1 block text-sm font-medium text-gray-700">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="create-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="Jane Doe"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="create-email" className="mb-1 block text-sm font-medium text-gray-700">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          id="create-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={255}
          placeholder="jane@example.com"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="create-username" className="mb-1 block text-sm font-medium text-gray-700">
          Username <span className="text-xs text-gray-400">(optional)</span>
        </label>
        <input
          id="create-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={30}
          placeholder="jane_doe"
          pattern="^[a-zA-Z0-9_]+$"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">3-30 characters, letters, numbers, and underscores only.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500">
        No password is set. The user will receive a password-reset email to create their initial password.
      </p>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create User'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
