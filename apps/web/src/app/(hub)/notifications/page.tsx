import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getAdminNotificationTemplates,
  getNotificationCategories,
} from '@/lib/queries/admin-notifications';
import { formatDate } from '@twicely/utils/format';
import { Bell, Lock, Plus } from 'lucide-react';
import { NotificationTemplateToggle } from '@/components/admin/notification-template-toggle';

export const metadata: Metadata = {
  title: 'Notification Templates | Twicely Hub',
  robots: { index: false, follow: false },
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  PUSH: 'Push',
  IN_APP: 'In-App',
  SMS: 'SMS',
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Notification')) {
    return <p className="p-6 text-sm text-red-600">Access denied.</p>;
  }

  const params = await searchParams;
  const categoryFilter = params['category'];
  const activeFilter =
    params['active'] === 'true' ? true : params['active'] === 'false' ? false : undefined;

  const [templates, categories] = await Promise.all([
    getAdminNotificationTemplates({
      category: categoryFilter,
      isActive: activeFilter,
    }),
    getNotificationCategories(),
  ]);

  const activeCount = templates.filter((t) => t.isActive).length;
  const inactiveCount = templates.filter((t) => !t.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Notification Templates</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage notification templates and channel defaults.
          </p>
        </div>
        <Link
          href="/notifications/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Template
        </Link>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">
          <strong className="text-gray-900">{templates.length}</strong> total
        </span>
        <span className="text-gray-500">
          <strong className="text-green-700">{activeCount}</strong> active
        </span>
        <span className="text-gray-500">
          <strong className="text-gray-400">{inactiveCount}</strong> inactive
        </span>
      </div>

      <form method="GET" className="flex items-center gap-3">
        <select
          name="category"
          defaultValue={categoryFilter ?? ''}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          name="active"
          defaultValue={params['active'] ?? ''}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Filter
        </button>
        <Link href="/notifications" className="text-sm text-gray-500 hover:text-gray-700">
          Clear
        </Link>
      </form>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Bell className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-600">No templates yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Create your first notification template.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Channels</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">System</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-primary/70">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/notifications/${template.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {template.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">{template.key}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {template.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {template.channels.map((ch) => (
                        <span
                          key={ch}
                          className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {CHANNEL_LABELS[ch] ?? ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {template.isSystemOnly && (
                      <Lock className="h-4 w-4 text-gray-400" aria-label="System-only" />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {formatDate(template.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <NotificationTemplateToggle
                        templateId={template.id}
                        isActive={template.isActive}
                      />
                      <Link
                        href={`/notifications/${template.id}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
