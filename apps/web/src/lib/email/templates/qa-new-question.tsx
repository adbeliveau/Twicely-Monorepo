import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface QaNewQuestionEmailProps {
  recipientName: string;
  askerName: string;
  itemTitle: string;
  questionText: string;
  listingUrl: string;
}

export default function QaNewQuestionEmail({
  recipientName,
  askerName,
  itemTitle,
  questionText,
  listingUrl,
}: QaNewQuestionEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>New Question on Your Listing</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            <strong>{askerName}</strong> asked a question on your listing{' '}
            <strong>{itemTitle}</strong>:
          </Text>
          <Text style={{ margin: '0 0 16px', fontStyle: 'italic', color: '#444' }}>
            &ldquo;{questionText}&rdquo;
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={listingUrl} style={{ color: '#7C3AED' }}>View listing and answer →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because someone asked a question on your listing on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
