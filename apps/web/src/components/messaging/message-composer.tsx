'use client';

import { useState, useTransition, useRef, useEffect, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Textarea } from '@twicely/ui/textarea';
import { Send, Paperclip, X } from 'lucide-react';
import { sendMessage } from '@/lib/actions/messaging-actions';
import { MESSAGING_QUICK_REPLIES } from '@/lib/messaging/messaging-quick-replies';

const MAX_ATTACHMENTS = 4;

interface MessageComposerProps {
  conversationId: string;
  onMessageSent?: (msg: { body: string; attachments: string[] }) => void;
}

export function MessageComposer({ conversationId, onMessageSent }: MessageComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = () => {
    if (!body.trim() || isPending) return;

    const bodyToSend = body.trim();
    const attachmentsToSend = [...attachments];
    setError(null);

    startTransition(async () => {
      const result = await sendMessage({ conversationId, body: bodyToSend, attachments: attachmentsToSend });
      if (result.success) {
        onMessageSent?.({ body: bodyToSend, attachments: attachmentsToSend });
        setBody('');
        setAttachments([]);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to send message');
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = MAX_ATTACHMENTS - attachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploadingCount((c) => c + toUpload.length);

    for (const file of toUpload) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'message-attachment');

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = (await res.json()) as { success: boolean; url?: string; error?: string };
        if (data.success && data.url) {
          setAttachments((prev) => [...prev, data.url!]);
        } else {
          setError('Failed to upload image.');
        }
      } catch {
        setError('Failed to upload image.');
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a !== url));
  };

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, []);

  const sendTypingIndicator = () => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      fetch('/api/messaging/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {});
    }, 1500);
  };

  const isUploading = uploadingCount > 0;
  const canAttach = attachments.length < MAX_ATTACHMENTS && !isUploading;

  return (
    <div className="border-t bg-white p-4">
      {error && (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      )}

      {/* Quick reply chips */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
        {MESSAGING_QUICK_REPLIES.map((reply) => (
          <button
            key={reply.id}
            type="button"
            onClick={() => setBody(reply.text)}
            className="text-xs py-1 px-2 rounded-full border border-gray-200 whitespace-nowrap hover:bg-gray-50 transition-colors shrink-0"
          >
            {reply.label}
          </button>
        ))}
      </div>

      {/* Attachment thumbnails */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((url) => (
            <div key={url} className="relative h-8 w-8 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Attachment" className="h-8 w-8 rounded object-cover" />
              <button
                type="button"
                onClick={() => removeAttachment(url)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gray-600 text-white flex items-center justify-center"
                aria-label="Remove attachment"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); sendTypingIndicator(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={3}
          maxLength={5000}
          disabled={isPending}
          className="resize-none"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => { void handleFilesSelected(e.target.files); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAttach}
              title={canAttach ? 'Attach image' : `Maximum ${MAX_ATTACHMENTS} images`}
              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:text-gray-200"
              aria-label="Attach image"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-400">{body.length}/5000</span>
          </div>
          <Button
            onClick={handleSend}
            disabled={isPending || !body.trim() || isUploading}
            size="sm"
          >
            <Send className="mr-1.5 h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
