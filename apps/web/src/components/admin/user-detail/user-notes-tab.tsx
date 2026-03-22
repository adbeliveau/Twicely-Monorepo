'use client';

import { useTransition, useState } from 'react';
import { addInternalNoteAction } from '@/lib/actions/admin-users-management';

interface NoteEvent {
  id: string;
  actorId: string | null;
  detailsJson: unknown;
  createdAt: Date;
}

interface UserNotesTabProps {
  userId: string;
  notes: NoteEvent[];
}

function getContent(detailsJson: unknown): string {
  if (detailsJson && typeof detailsJson === 'object' && 'content' in detailsJson) {
    return String((detailsJson as { content: unknown }).content);
  }
  return '(no content)';
}

export function UserNotesTab({ userId, notes }: UserNotesTabProps) {
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState('');
  const [result, setResult] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      const res = await addInternalNoteAction({ userId, content: content.trim() });
      if (res.error) {
        setResult(`Error: ${res.error}`);
      } else {
        setResult('Note saved');
        setContent('');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Add note form */}
      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="mb-3 font-bold text-gray-900 dark:text-white">Add Internal Note</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Internal note (not visible to user)..."
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">{content.length}/2000</span>
            <button
              type="submit"
              disabled={pending || !content.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Saving...' : 'Save Note'}
            </button>
          </div>
          {result && <p className="text-xs text-gray-500 dark:text-gray-400">{result}</p>}
        </form>
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {notes.length === 0 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-800">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">No internal notes</p>
          </div>
        )}
        {notes.map((note) => (
          <div key={note.id} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                By {note.actorId?.slice(0, 8) ?? 'unknown'} &middot; {note.createdAt.toLocaleString()}
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{getContent(note.detailsJson)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
