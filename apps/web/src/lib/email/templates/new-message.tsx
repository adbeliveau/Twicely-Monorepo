import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface NewMessageEmailProps {
  senderName: string;
  itemTitle: string;
  messagePreview: string;
  conversationUrl: string;
}

export default function NewMessageEmail({
  senderName,
  itemTitle,
  messagePreview,
  conversationUrl,
}: NewMessageEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>New Message</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            <strong>{senderName}</strong> sent you a message about{' '}
            <strong>{itemTitle}</strong>:
          </Text>
          <Text style={{ margin: '0 0 16px', fontStyle: 'italic', color: '#444' }}>
            &ldquo;{messagePreview}&rdquo;
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={conversationUrl} style={{ color: '#7C3AED' }}>View Conversation →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because someone sent you a message on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
