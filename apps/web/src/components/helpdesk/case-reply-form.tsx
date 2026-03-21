'use client';

import { useState, useTransition } from 'react';
import { addUserReply } from '@/lib/actions/helpdesk-cases';
import { Send } from 'lucide-react';

interface CaseReplyFormProps {
  caseId: string;
}

export function CaseReplyForm({ caseId }: CaseReplyFormProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await addUserReply(caseId, { body: body.trim() });
      if (result.success) {
        setBody('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error ?? 'Failed to send reply.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply here…"
        rows={4}
        disabled={isPending}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
        aria-label="Reply body"
      />
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-600">Reply sent.</p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          {isPending ? 'Sending…' : 'Send Reply'}
        </button>
      </div>
    </form>
  );
}
