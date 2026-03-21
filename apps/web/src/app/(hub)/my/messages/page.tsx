import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authorize } from '@twicely/casl/authorize';
import { getConversations } from '@/lib/queries/messaging';
import { ConversationList } from '@/components/messaging/conversation-list';
import { MessageSquare } from 'lucide-react';
import { cn } from '@twicely/utils/cn';

export const metadata: Metadata = { title: 'Messages | Twicely' };
export const dynamic = 'force-dynamic';

type MessageRole = 'buyer' | 'seller' | 'both';

function parseRole(raw: string | undefined): MessageRole {
  if (raw === 'buyer' || raw === 'seller' || raw === 'both') return raw;
  return 'both';
}

interface MessagesPageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const { session, ability } = await authorize();
  if (!session) redirect('/auth/login?callbackUrl=/my/messages');
  if (!ability.can('read', 'Conversation')) redirect('/auth/login?callbackUrl=/my/messages');

  const { role: rawRole } = await searchParams;
  const role = parseRole(rawRole);

  const conversations = await getConversations(session.userId, role);

  const tabs: { label: string; value: MessageRole }[] = [
    { label: 'All', value: 'both' },
    { label: 'Buying', value: 'buyer' },
    { label: 'Selling', value: 'seller' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {/* Filter tabs */}
      <nav role="tablist" className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/my/messages?role=${tab.value}`}
            role="tab"
            aria-selected={role === tab.value}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              role === tab.value
                ? 'border-b-2 border-primary text-primary bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500">
            No messages yet. Start a conversation from any listing page.
          </p>
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          currentUserId={session.userId}
        />
      )}
    </div>
  );
}
