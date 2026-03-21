import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getNotificationCategories } from '@/lib/queries/admin-notifications';
import { NotificationTemplateEditor } from '@/components/admin/notification-template-editor';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'New Template | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function NewNotificationTemplatePage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'Notification')) {
    return <p className="p-6 text-sm text-red-600">Access denied.</p>;
  }

  const categories = await getNotificationCategories();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href="/notifications"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Notification Templates
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-primary">New Template</h1>
      </div>

      <NotificationTemplateEditor categories={categories} />
    </div>
  );
}
