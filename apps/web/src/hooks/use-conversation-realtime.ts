'use client';

/**
 * useConversationRealtime — subscribes to a Centrifugo conversation channel.
 *
 * On mount: fetches a subscription token via POST /api/realtime/subscribe,
 * connects a Centrifuge instance, and listens for message and typing events.
 * On unmount: disconnects the Centrifuge instance.
 */

import { useEffect, useRef, useState } from 'react';
import { Centrifuge } from 'centrifuge';
import type { MessageItem } from '@/lib/queries/messaging';

interface UseConversationRealtimeProps {
  conversationId: string;
  currentUserId: string;
  onNewMessage: (msg: MessageItem) => void;
  onTyping: (userId: string) => void;
}

interface UseConversationRealtimeResult {
  isConnected: boolean;
}

export function useConversationRealtime({
  conversationId,
  currentUserId,
  onNewMessage,
  onTyping,
}: UseConversationRealtimeProps): UseConversationRealtimeResult {
  const [isConnected, setIsConnected] = useState(false);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const channel = `private-conversation.${conversationId}`;

  useEffect(() => {
    const centrifugoUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_URL;

    if (!centrifugoUrl) {
      // Warn once — no crash, just no real-time
      // eslint-disable-next-line no-console
      console.warn('[useConversationRealtime] NEXT_PUBLIC_CENTRIFUGO_URL not set — real-time disabled');
      return;
    }

    let cancelled = false;

    async function connect(): Promise<void> {
      // Fetch subscription token
      let token: string;
      try {
        const res = await fetch('/api/realtime/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { success: boolean; token?: string };
        if (!data.success || !data.token) return;
        token = data.token;
      } catch {
        return;
      }

      if (cancelled) return;
      if (!centrifugoUrl) return;

      const centrifuge = new Centrifuge(centrifugoUrl, { token });
      centrifugeRef.current = centrifuge;

      const sub = centrifuge.newSubscription(channel);

      sub.on('publication', (ctx) => {
        const data = ctx.data as { type: string; message?: MessageItem; userId?: string };

        if (data.type === 'message' && data.message) {
          onNewMessage(data.message);
        } else if (data.type === 'typing' && data.userId && data.userId !== currentUserId) {
          onTyping(data.userId);
        }
      });

      sub.subscribe();

      centrifuge.on('connected', () => {
        if (!cancelled) setIsConnected(true);
      });

      centrifuge.on('disconnected', () => {
        if (!cancelled) setIsConnected(false);
      });

      centrifuge.connect();
    }

    void connect();

    return () => {
      cancelled = true;
      if (centrifugeRef.current) {
        centrifugeRef.current.disconnect();
        centrifugeRef.current = null;
      }
      setIsConnected(false);
    };
    // onNewMessage and onTyping are intentionally excluded — callers should stabilize them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId, channel]);

  return { isConnected };
}
