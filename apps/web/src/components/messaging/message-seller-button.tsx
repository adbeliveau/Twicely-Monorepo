'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Textarea } from '@twicely/ui/textarea';
import { MessageSquare, Send, X } from 'lucide-react';
import { createConversation } from '@/lib/actions/messaging-actions';

interface MessageSellerButtonProps {
  listingId: string;
  sellerId: string;
  isLoggedIn: boolean;
  existingConversationId: string | null;
  listingSlug: string;
}

export function MessageSellerButton({
  listingId,
  sellerId: _sellerId,
  isLoggedIn,
  existingConversationId,
  listingSlug,
}: MessageSellerButtonProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!isLoggedIn) {
      router.push(`/auth/login?callbackUrl=/i/${listingSlug}`);
      return;
    }

    if (existingConversationId) {
      router.push(`/my/messages/${existingConversationId}`);
      return;
    }

    setShowForm(true);
  };

  const handleSend = () => {
    if (!body.trim() || isPending) return;

    setError(null);
    const bodyToSend = body.trim();

    startTransition(async () => {
      const result = await createConversation({ listingId, body: bodyToSend });
      if (result.success && result.conversationId) {
        router.push(`/my/messages/${result.conversationId}`);
      } else {
        setError(result.error ?? 'Failed to start conversation');
      }
    });
  };

  if (showForm) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Message Seller</p>
          <button
            type="button"
            onClick={() => { setShowForm(false); setBody(''); setError(null); }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          rows={3}
          maxLength={5000}
          disabled={isPending}
          className="resize-none"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{body.length}/5000</span>
          <Button
            onClick={handleSend}
            disabled={isPending || !body.trim()}
            size="sm"
          >
            <Send className="mr-1.5 h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleClick}
      disabled={isPending}
    >
      <MessageSquare className="mr-2 h-4 w-4" />
      Message Seller
    </Button>
  );
}
