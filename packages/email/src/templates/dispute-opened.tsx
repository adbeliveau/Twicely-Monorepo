import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface DisputeOpenedEmailProps {
  recipientName: string;
  orderNumber: string;
  disputeReason: string;
  deadlineDate: string;
  disputeUrl: string;
}

export default function DisputeOpenedEmail({
  recipientName,
  orderNumber,
  disputeReason,
  deadlineDate,
  disputeUrl,
}: DisputeOpenedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#DC2626', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Dispute Opened</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            A dispute has been opened for order <strong>{orderNumber}</strong>.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Dispute reason:</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            {disputeReason}
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            Our team will review this dispute and make a decision by <strong>{deadlineDate}</strong>.
            You may be asked to provide additional evidence.
          </Text>
          <Button
            href={disputeUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Dispute Details
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a dispute was opened on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
