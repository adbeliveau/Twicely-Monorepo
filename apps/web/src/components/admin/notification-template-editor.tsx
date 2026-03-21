'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createNotificationTemplateAction,
  updateNotificationTemplateAction,
  deleteNotificationTemplateAction,
} from '@/lib/actions/admin-notifications';

const CHANNELS = ['EMAIL', 'PUSH', 'IN_APP', 'SMS'] as const;
type Channel = (typeof CHANNELS)[number];

interface NotificationTemplateEditorProps {
  initialData?: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    category: string;
    subjectTemplate: string | null;
    bodyTemplate: string;
    htmlTemplate: string | null;
    channels: string[];
    isSystemOnly: boolean;
    isActive: boolean;
  };
  categories?: string[];
}

export function NotificationTemplateEditor({
  initialData,
  categories = [],
}: NotificationTemplateEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isEdit = initialData !== undefined;

  const [fields, setFields] = useState({
    key: initialData?.key ?? '',
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    category: initialData?.category ?? '',
    subjectTemplate: initialData?.subjectTemplate ?? '',
    bodyTemplate: initialData?.bodyTemplate ?? '',
    htmlTemplate: initialData?.htmlTemplate ?? '',
    channels: (initialData?.channels ?? ['EMAIL']) as Channel[],
    isSystemOnly: initialData?.isSystemOnly ?? false,
    isActive: initialData?.isActive ?? true,
  });

  function toggleChannel(ch: Channel) {
    setFields((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let result: { success?: boolean; templateId?: string; error?: string } | undefined;

      if (isEdit) {
        result = await updateNotificationTemplateAction({
          templateId: initialData.id,
          name: fields.name,
          description: fields.description || null,
          category: fields.category,
          subjectTemplate: fields.subjectTemplate || null,
          bodyTemplate: fields.bodyTemplate,
          htmlTemplate: fields.htmlTemplate || null,
          channels: fields.channels,
          isSystemOnly: fields.isSystemOnly,
          isActive: fields.isActive,
        });
      } else {
        result = await createNotificationTemplateAction({
          key: fields.key,
          name: fields.name,
          description: fields.description || null,
          category: fields.category,
          subjectTemplate: fields.subjectTemplate || null,
          bodyTemplate: fields.bodyTemplate,
          htmlTemplate: fields.htmlTemplate || null,
          channels: fields.channels,
          isSystemOnly: fields.isSystemOnly,
          isActive: fields.isActive,
        });
      }

      if (!result || 'error' in result) {
        setError(result?.error ?? 'An error occurred');
        return;
      }

      router.push('/notifications');
    });
  }

  function handleDelete() {
    if (!initialData) return;
    startTransition(async () => {
      const result = await deleteNotificationTemplateAction({ templateId: initialData.id });
      if (result && 'error' in result) {
        setError(result.error ?? 'Delete failed');
        setShowDeleteDialog(false);
        return;
      }
      router.push('/notifications');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fields.key}
            onChange={(e) => setFields((p) => ({ ...p, key: e.target.value }))}
            disabled={isEdit}
            placeholder="order.confirmed"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={!isEdit}
          />
          <p className="mt-1 text-xs text-gray-400">
            Lowercase dot-separated identifier. Cannot be changed after creation.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fields.name}
            onChange={(e) => setFields((p) => ({ ...p, name: e.target.value }))}
            placeholder="Order Confirmed"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={fields.description}
          onChange={(e) => setFields((p) => ({ ...p, description: e.target.value }))}
          placeholder="Optional description of when this template is sent."
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Category <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          list="category-suggestions"
          value={fields.category}
          onChange={(e) => setFields((p) => ({ ...p, category: e.target.value }))}
          placeholder="orders"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <datalist id="category-suggestions">
          {categories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Subject Template</label>
        <input
          type="text"
          value={fields.subjectTemplate}
          onChange={(e) => setFields((p) => ({ ...p, subjectTemplate: e.target.value }))}
          placeholder="Your order {{orderId}} has been confirmed"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">Use {'{{variableName}}'} for dynamic content.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Body Template <span className="text-red-500">*</span>
        </label>
        <textarea
          value={fields.bodyTemplate}
          onChange={(e) => setFields((p) => ({ ...p, bodyTemplate: e.target.value }))}
          placeholder="Hi {{buyerName}}, your order for {{itemTitle}} has been confirmed."
          rows={5}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="mt-1 text-xs text-gray-400">Use {'{{variableName}}'} for dynamic content.</p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowHtml((v) => !v)}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          {showHtml ? 'Hide HTML template' : 'Show HTML template'}
        </button>
        {showHtml && (
          <textarea
            value={fields.htmlTemplate}
            onChange={(e) => setFields((p) => ({ ...p, htmlTemplate: e.target.value }))}
            placeholder="<p>Hi {{buyerName}},</p>"
            rows={8}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700">
          Channels <span className="text-red-500">*</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {CHANNELS.map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={fields.channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {ch === 'IN_APP' ? 'In-App' : ch.charAt(0) + ch.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={fields.isSystemOnly}
            onChange={(e) => setFields((p) => ({ ...p, isSystemOnly: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          System only — prevent users from disabling this notification
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={fields.isActive}
            onChange={(e) => setFields((p) => ({ ...p, isActive: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Active
        </label>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
        </button>

        {isEdit && !initialData.isSystemOnly && (
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Delete Template
          </button>
        )}
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-gray-900">Delete Template</h2>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this template? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
