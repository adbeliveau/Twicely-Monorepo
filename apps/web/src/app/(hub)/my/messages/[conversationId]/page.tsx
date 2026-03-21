import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { authorize } from '@twicely/casl/authorize';
import { getConversationMessages } from '@/lib/queries/messaging';
import { markAsRead } from '@/lib/actions/messaging-manage';
import { ConversationThread } from '@/components/messaging/conversation-thread';

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  const { conversationId } = await params;
  const { session } = await authorize();
  if (!session) return { title: 'Message | Twicely' };

  const data = await getConversationMessages(conversationId, session.userId, session.onBehalfOfSellerId);
  if (!data) return { title: 'Message | Twicely' };

  const subject = data.conversation.subject ?? 'Conversation';
  return { title: `${subject} — Message | Twicely` };
}

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;
  const { session, ability } = await authorize();
  if (!session) redirect('/auth/login?callbackUrl=/my/messages');
  if (!ability.can('read', 'Conversation')) redirect('/auth/login?callbackUrl=/my/messages');

  const data = await getConversationMessages(conversationId, session.userId, session.onBehalfOfSellerId);
  if (!data) notFound();

  // Fire-and-forget: mark messages as read
  markAsRead({ conversationId }).catch(() => {});

  return (
    <div className="max-w-3xl mx-auto h-full">
      <ConversationThread
        conversation={data.conversation}
        messages={data.messages}
        currentUserId={session.userId}
      />
    </div>
  );
}
