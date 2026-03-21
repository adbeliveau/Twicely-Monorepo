import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface DisputeResolvedEmailProps {
  recipientName: string;
  orderNumber: string;
  resolution: string;
  resolutionNote: string;
  orderUrl: string;
}

export default function DisputeResolvedEmail({
  recipientName,
  orderNumber,
  resolution,
  resolutionNote,
  orderUrl,
}: DisputeResolvedEmailProps) {
  const isResolved = resolution.includes('buyer') || resolution.includes('refund');

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: isResolved ? '#10B981' : '#6B7280', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Dispute Resolved</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            The dispute for order <strong>{orderNumber}</strong> has been resolved.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Resolution:</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            {resolution}
          </Text>
          {resolutionNote && (
            <>
              <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Additional notes:</Text>
              <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
                {resolutionNote}
              </Text>
            </>
          )}
          <Button
            href={orderUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Order
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a dispute was resolved on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
