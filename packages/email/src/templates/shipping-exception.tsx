import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface ShippingExceptionEmailProps {
  buyerName: string;
  orderNumber: string;
  exceptionType: string;
  exceptionDescription: string;
  claimUrl: string;
}

export default function ShippingExceptionEmail({
  buyerName,
  orderNumber,
  exceptionType,
  exceptionDescription,
  claimUrl,
}: ShippingExceptionEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#F59E0B', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Shipping Issue Detected</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            We noticed a potential shipping issue with your order <strong>{orderNumber}</strong>.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Issue: {exceptionType}</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#FEF3C7', borderRadius: 4, color: '#92400E' }}>
            {exceptionDescription}
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            We have automatically opened a protection claim on your behalf. Our team will investigate
            and work to resolve this issue as quickly as possible.
          </Text>
          <Button
            href={claimUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Claim Details
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because we detected a shipping issue with your Twicely order.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
