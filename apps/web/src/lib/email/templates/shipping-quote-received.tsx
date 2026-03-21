import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface ShippingQuoteReceivedEmailProps {
  orderNumber: string;
  sellerName: string;
  quotedAmountFormatted: string;
  savingsFormatted: string;
  orderUrl: string;
}

export default function ShippingQuoteReceivedEmail({
  orderNumber,
  sellerName,
  quotedAmountFormatted,
  savingsFormatted,
  orderUrl,
}: ShippingQuoteReceivedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Shipping Quote Received</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            <strong>{sellerName}</strong> provided a combined shipping quote of{' '}
            <strong>{quotedAmountFormatted}</strong> for order <strong>{orderNumber}</strong>.
            You save <strong style={{ color: '#16a34a' }}>{savingsFormatted}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={orderUrl} style={{ color: '#7C3AED' }}>Review Quote →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a seller submitted a combined shipping quote on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
