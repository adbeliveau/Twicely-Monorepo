'use client';

import { useState, useCallback, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { savePuckData } from '@/lib/actions/storefront-pages';
import { puckConfig } from '@/components/storefront/puck-config';
import type { Data } from '@puckeditor/core';

// Dynamic import with ssr: false to avoid Turbopack + Puck + Tailwind v4 issues
const Puck = dynamic(
  () => import('@puckeditor/core').then((mod) => mod.Puck),
  { ssr: false }
);

interface PuckEditorClientProps {
  pageId: string;
  initialData: unknown;
}

export function PuckEditorClient({
  pageId,
  initialData,
}: PuckEditorClientProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, startTransition] = useTransition();

  const handlePublish = useCallback(
    (data: Data) => {
      setSaveStatus('saving');
      startTransition(async () => {
        const result = await savePuckData({ pageId, puckData: data });
        setSaveStatus(result.success ? 'saved' : 'error');
        if (result.success) {
          // Reset status after 2s
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      });
    },
    [pageId]
  );

  return (
    <div className="relative h-full">
      {/* Save status indicator */}
      <div className="absolute right-4 top-4 z-50">
        {saveStatus === 'saving' && (
          <span className="text-xs text-gray-500">Saving...</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-xs text-green-600">Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-600">Save failed</span>
        )}
      </div>

      <Puck
        config={puckConfig}
        data={initialData as Data}
        onPublish={handlePublish}
      />
    </div>
  );
}
