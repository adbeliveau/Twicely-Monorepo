import Link from 'next/link';
import { getReportTargetPreview } from '@/lib/queries/admin-report-target';
import type { ContentReportTarget } from '@/lib/queries/admin-report-target';

interface ReportTargetPreviewProps {
  targetType: ContentReportTarget;
  targetId: string;
}

export async function ReportTargetPreview({ targetType, targetId }: ReportTargetPreviewProps) {
  const preview = await getReportTargetPreview(targetType, targetId);

  if (!preview) {
    return (
      <p className="text-xs text-gray-400 italic">Target not found (may have been deleted)</p>
    );
  }

  if (preview.type === 'LISTING') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="font-medium text-gray-800">{preview.title ?? '(No title)'}</p>
        <p className="mt-0.5 text-xs text-gray-500">Status: {preview.status}</p>
        <Link
          href={`/mod/listings/${targetId}`}
          className="mt-1 inline-block text-xs text-blue-600 hover:underline"
        >
          View in listings admin
        </Link>
      </div>
    );
  }

  if (preview.type === 'REVIEW') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="text-xs font-medium text-gray-500 mb-1">Rating: {preview.rating}/5</p>
        <p className="text-gray-700 text-xs italic">&ldquo;{preview.excerpt}&rdquo;</p>
      </div>
    );
  }

  if (preview.type === 'MESSAGE') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="text-gray-700 text-xs italic">&ldquo;{preview.excerpt}&rdquo;</p>
      </div>
    );
  }

  if (preview.type === 'USER') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="font-medium text-gray-800">{preview.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">{preview.email}</p>
        {preview.isBanned && (
          <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Banned
          </span>
        )}
        <Link
          href={`/usr/${targetId}`}
          className="mt-1 inline-block text-xs text-blue-600 hover:underline"
        >
          View user profile
        </Link>
      </div>
    );
  }

  return null;
}
