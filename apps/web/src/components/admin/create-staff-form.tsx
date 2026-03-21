'use client';

/**
 * CreateStaffForm — Form for creating a new staff user (A4)
 */

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStaffUserAction } from '@/lib/actions/admin-staff';
import type { PlatformRole } from '@twicely/casl/types';

const ALL_ROLES: PlatformRole[] = [
  'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
  'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN',
];

const ELEVATED_ROLES: PlatformRole[] = ['ADMIN', 'SUPER_ADMIN'];

interface CreateStaffFormProps {
  viewerRoles: PlatformRole[];
}

export function CreateStaffForm({ viewerRoles }: CreateStaffFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<PlatformRole[]>([]);
  const router = useRouter();

  const isSuperAdmin = viewerRoles.includes('SUPER_ADMIN');

  function toggleRole(role: PlatformRole) {
    if (ELEVATED_ROLES.includes(role) && !isSuperAdmin) return;
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedRoles.length === 0) {
      setError('At least one role is required');
      return;
    }

    startTransition(async () => {
      const res = await createStaffUserAction({
        email,
        displayName,
        password,
        roles: selectedRoles,
      });

      if ('error' in res) {
        setError(res.error ?? 'An error occurred');
        return;
      }

      router.push('/roles/staff/' + res.staffUserId);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={255}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          placeholder="staff@hub.twicely.co"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Display Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={1}
          maxLength={100}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          placeholder="Jane Smith"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
          maxLength={128}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          placeholder="Minimum 10 characters"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Roles <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ROLES.map((role) => {
            const isElevated = ELEVATED_ROLES.includes(role);
            const disabled = isElevated && !isSuperAdmin;
            return (
              <label
                key={role}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer ${
                  disabled ? 'cursor-not-allowed opacity-50 bg-gray-50' : 'hover:bg-gray-50'
                } ${selectedRoles.includes(role) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
                title={disabled ? 'Only SUPER_ADMIN can grant this role' : undefined}
              >
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  disabled={disabled || pending}
                  className="h-3.5 w-3.5"
                />
                <span className="font-mono text-xs">{role}</span>
              </label>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-5 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? 'Creating...' : 'Create Staff User'}
      </button>
    </form>
  );
}
