import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getAdminNotificationTemplateById,
  getNotificationCategories,
} from '@/lib/queries/admin-notifications';
import { NotificationTemplateEditor } from '@/components/admin/notification-template-editor';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Edit Template | Twicely Hub',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function EditNotificationTemplatePage({ params }: Props) {
  const { id } = await params;
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Notification')) {
    return <p className="p-6 text-sm text-red-600">Access denied.</p>;
  }

  const [template, categories] = await Promise.all([
    getAdminNotificationTemplateById(id),
    getNotificationCategories(),
  ]);

  if (!template) notFound();

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
        <h1 className="text-xl font-semibold text-primary">Edit Template</h1>
        <p className="mt-0.5 text-sm text-gray-500">{template.key}</p>
      </div>

      <NotificationTemplateEditor
        initialData={{
          id: template.id,
          key: template.key,
          name: template.name,
          description: template.description,
          category: template.category,
          subjectTemplate: template.subjectTemplate,
          bodyTemplate: template.bodyTemplate,
          htmlTemplate: template.htmlTemplate,
          channels: template.channels,
          isSystemOnly: template.isSystemOnly,
          isActive: template.isActive,
        }}
        categories={categories}
      />
    </div>
  );
}
