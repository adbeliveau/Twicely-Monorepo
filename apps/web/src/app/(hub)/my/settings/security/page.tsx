'use client';

import { useState, useEffect, useCallback } from 'react';
import { authClient, useSession } from '@twicely/auth/client';

interface SessionData {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';

  // Simple parsing - extract browser and OS
  if (ua.includes('Chrome')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari')) return 'Safari Browser';
  if (ua.includes('Edge')) return 'Edge Browser';
  return 'Unknown Browser';
}

export default function SettingsSecurityPage() {
  const { data: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const result = await authClient.listSessions();
      if (result.data) {
        setSessions(result.data as SessionData[]);
      }
    } catch {
      setError('Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleRevokeSession(token: string, sessionId: string) {
    setRevokingSessionId(sessionId);
    try {
      await authClient.revokeSession({ token });
      setSessions(sessions.filter(s => s.id !== sessionId));
      setMessage('Session revoked successfully');
    } catch {
      setError('Failed to revoke session');
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function handleRevokeAllOther() {
    setIsRevokingAll(true);
    try {
      await authClient.revokeOtherSessions();
      await loadSessions();
      setMessage('All other sessions revoked successfully');
    } catch {
      setError('Failed to revoke sessions');
    } finally {
      setIsRevokingAll(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to change password');
        setIsLoading(false);
        return;
      }

      setMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsLoading(false);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  }

  // Get current session token for comparison
  const currentToken = currentSession?.session?.token;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Security Settings</h1>

      {message && (
        <div className="bg-green-50 text-green-600 p-3 rounded text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Change Password Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Active Sessions Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Active Sessions</h2>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAllOther}
              disabled={isRevokingAll}
              className="text-sm px-3 py-1 text-red-600 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              {isRevokingAll ? 'Revoking...' : 'Revoke All Other Sessions'}
            </button>
          )}
        </div>

        {isLoadingSessions ? (
          <p className="text-gray-500">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-gray-500">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isCurrent = session.token === currentToken;
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{parseUserAgent(session.userAgent)}</span>
                      {isCurrent && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {session.ipAddress || 'Unknown IP'} &bull; Last active:{' '}
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session.token, session.id)}
                      disabled={revokingSessionId === session.id}
                      className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                    >
                      {revokingSessionId === session.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-Factor Authentication Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Two-Factor Authentication</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <p className="text-gray-600 text-sm">
            Two-factor authentication adds an extra layer of security to your account.
          </p>
          <p className="text-gray-500 text-sm mt-2 italic">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
