'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@twicely/auth/client';
import { updateProfile, checkUsernameAvailability } from '@/lib/auth/actions';
import type { ExtendedUser } from '@twicely/auth/server';

export default function SettingsProfilePage() {
  const { data: session } = useSession();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Cast session user to extended type once
  const extendedUser = session?.user as ExtendedUser | undefined;

  useEffect(() => {
    if (extendedUser) {
      setName(extendedUser.name || '');
      setDisplayName(extendedUser.displayName || '');
      setUsername(extendedUser.username || '');
      setBio(extendedUser.bio || '');
      setPhone(extendedUser.phone || '');
      setMarketingOptIn(extendedUser.marketingOptIn || false);
    }
  }, [extendedUser]);

  async function handleCheckUsername(value: string) {
    if (!value || value.length < 3) {
      setUsernameError('');
      return;
    }

    // Skip check if username hasn't changed
    if (value === extendedUser?.username) {
      setUsernameError('');
      return;
    }

    setIsCheckingUsername(true);
    try {
      const result = await checkUsernameAvailability(value);
      if (!result.available) {
        setUsernameError('This username is already taken');
      } else {
        setUsernameError('');
      }
    } catch {
      setUsernameError('');
    } finally {
      setIsCheckingUsername(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (usernameError) {
      setError('Please fix the username error before saving');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updateProfile({
        name,
        displayName: displayName || undefined,
        username: username || undefined,
        bio: bio || undefined,
        phone: phone || undefined,
        marketingOptIn,
      });

      if (!result.success) {
        setError(result.error || 'Failed to update profile');
        setIsLoading(false);
        return;
      }

      setMessage('Profile updated successfully');
      setIsLoading(false);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      {message && (
        <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={session?.user?.email || ''}
              disabled
              className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-1">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
              placeholder="How you want to appear to others"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={(e) => handleCheckUsername(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                usernameError ? 'border-red-500' : ''
              }`}
              disabled={isLoading}
              placeholder="Your unique username"
            />
            {isCheckingUsername && (
              <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
            )}
            {usernameError && (
              <p className="text-xs text-red-500 mt-1">{usernameError}</p>
            )}
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
              placeholder="Tell us about yourself"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="flex items-center">
            <input
              id="marketingOptIn"
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
              disabled={isLoading}
            />
            <label htmlFor="marketingOptIn" className="ml-2 text-sm text-gray-600">
              I want to receive marketing emails and promotions
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !!usernameError}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
