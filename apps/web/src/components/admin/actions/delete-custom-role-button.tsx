'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCustomRoleAction } from '@/lib/actions/admin-custom-roles-assign';

interface DeleteCustomRoleButtonProps {
  customRoleId: string;
  roleName: string;
  affectedCount: number;
}

export function DeleteCustomRoleButton({
  customRoleId,
  roleName,
  affectedCount,
}: DeleteCustomRoleButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomRoleAction({ customRoleId });
      if ('error' in result) {
        setError(result.error ?? 'An error occurred');
        setConfirming(false);
      } else {
        router.push('/roles');
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700
                   hover:bg-red-50"
      >
        Delete Role
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 space-y-3">
      <p className="text-sm text-red-800 font-medium">
        Are you sure you want to delete &ldquo;{roleName}&rdquo;?
      </p>
      {affectedCount > 0 && (
        <p className="text-sm text-red-700">
          This will remove the role from{' '}
          <span className="font-semibold">{affectedCount}</span> staff{' '}
          {affectedCount === 1 ? 'member' : 'members'}.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-white rounded px-2 py-1">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white
                     hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes, Delete Role'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700
                     hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
