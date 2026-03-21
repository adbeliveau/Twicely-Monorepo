import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface ReturnApprovedEmailProps {
  buyerName: string;
  orderNumber: string;
  itemTitle: string;
  returnInstructions: string;
  returnUrl: string;
}

export default function ReturnApprovedEmail({
  buyerName,
  orderNumber,
  itemTitle,
  returnInstructions,
  returnUrl,
}: ReturnApprovedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#10B981', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Return Approved</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            Your return request for <strong>{itemTitle}</strong> from order <strong>{orderNumber}</strong> has been approved.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Next Steps:</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            {returnInstructions}
          </Text>
          <Button
            href={returnUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Return Details
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because your return request was approved on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
