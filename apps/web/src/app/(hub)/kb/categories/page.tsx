import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminKbCategories } from '@/lib/queries/kb-admin-queries';
import { KbCategoriesManager } from '@/components/helpdesk/kb-categories-manager';
import { FolderOpen, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'KB Categories | Twicely Hub' };

export default async function KbCategoriesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbCategory')) {
    return <p className="p-6 text-sm text-red-600">Access denied. HELPDESK_LEAD role required.</p>;
  }

  const categories = await getAdminKbCategories();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link
        href="/kb"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Knowledge Base
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          <h1 className="text-xl font-semibold text-primary">Categories</h1>
        </div>
      </div>

      <KbCategoriesManager categories={categories} />
    </div>
  );
}
