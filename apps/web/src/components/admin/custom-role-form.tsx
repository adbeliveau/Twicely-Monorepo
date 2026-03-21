'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionToggleGrid } from './permission-toggle-grid';
import {
  createCustomRoleAction,
  updateCustomRoleAction,
} from '@/lib/actions/admin-custom-roles';

interface CustomRoleFormProps {
  mode: 'create' | 'edit';
  /** Only provided in edit mode */
  initialData?: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    permissions: Array<{ subject: string; action: string }>;
  };
}

export function CustomRoleForm({ mode, initialData }: CustomRoleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [permissions, setPermissions] = useState<Array<{ subject: string; action: string }>>(
    initialData?.permissions ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-generate code preview from name (create mode only)
  const codePreview =
    mode === 'create'
      ? name.trim().toUpperCase().replace(/\s+/g, '_') || '—'
      : (initialData?.code ?? '—');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createCustomRoleAction({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
        });
        if ('error' in result) {
          setError(result.error ?? 'An error occurred');
        } else {
          router.push(`/roles/custom/${result.customRoleId}`);
        }
      } else {
        if (!initialData) return;
        const result = await updateCustomRoleAction({
          customRoleId: initialData.id,
          name: name.trim() !== initialData.name ? name.trim() : undefined,
          description: description.trim() || undefined,
          permissions,
        });
        if ('error' in result) {
          setError(result.error ?? 'An error occurred');
        } else {
          setSuccessMsg('Role updated successfully.');
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Display Name */}
      <div>
        <label htmlFor="role-name" className="block text-sm font-medium text-gray-700">
          Display Name <span className="text-red-500">*</span>
        </label>
        <input
          id="role-name"
          type="text"
          required
          minLength={3}
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Returns Specialist"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
        <p className="mt-1 text-xs text-gray-400">3–50 characters, letters, numbers, and spaces only.</p>
      </div>

      {/* Code (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Role Code</label>
        <div className="mt-1 flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-mono text-gray-500">
          {codePreview}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {mode === 'create'
            ? 'Auto-generated from the display name. Cannot be changed after creation.'
            : 'Code is immutable after creation.'}
        </p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="role-description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="role-description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this role is for..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Permission Toggle Grid */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
        <PermissionToggleGrid
          permissions={permissions}
          onChange={setPermissions}
          readOnly={false}
        />
      </div>

      {/* Feedback */}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {successMsg && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</p>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white
                     hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? mode === 'create' ? 'Creating…' : 'Saving…'
            : mode === 'create' ? 'Create Role' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/roles')}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
