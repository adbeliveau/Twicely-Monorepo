'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCollectionAction } from '@/lib/actions/admin-curated-collections';

interface CollectionDeleteButtonProps {
  collectionId: string;
  redirectAfter?: boolean;
}

export function CollectionDeleteButton({
  collectionId,
  redirectAfter = false,
}: CollectionDeleteButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCollectionAction({ collectionId });
      if ('error' in result) {
        setErrorMsg(result.error ?? 'An error occurred');
        setShowConfirm(false);
      } else {
        if (redirectAfter) {
          router.push('/mod/collections');
        } else {
          router.refresh();
        }
      }
    });
  }

  if (showConfirm) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-gray-600">Are you sure?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span>
      {errorMsg && <span className="text-xs text-red-600 mr-2">{errorMsg}</span>}
      <button
        onClick={() => setShowConfirm(true)}
        className="text-xs font-medium text-red-600 hover:text-red-800"
      >
        Delete
      </button>
    </span>
  );
}
