'use client';

interface TemplateDeleteDialogProps {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TemplateDeleteDialog({ pending, onCancel, onConfirm }: TemplateDeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-sm font-semibold text-gray-900">Delete Template</h2>
        <p className="mt-2 text-sm text-gray-500">
          Are you sure you want to delete this template? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
