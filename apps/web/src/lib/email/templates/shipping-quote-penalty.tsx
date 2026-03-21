import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface ShippingQuotePenaltyEmailProps {
  orderNumber: string;
  originalShippingFormatted: string;
  discountedShippingFormatted: string;
  savingsFormatted: string;
  orderUrl: string;
}

export default function ShippingQuotePenaltyEmail({
  orderNumber,
  originalShippingFormatted,
  discountedShippingFormatted,
  savingsFormatted,
  orderUrl,
}: ShippingQuotePenaltyEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Shipping Discount Applied</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            The seller did not provide a combined shipping quote in time for order{' '}
            <strong>{orderNumber}</strong>. Your shipping was reduced from{' '}
            <span style={{ textDecoration: 'line-through', color: '#666' }}>{originalShippingFormatted}</span>{' '}
            to <strong style={{ color: '#16a34a' }}>{discountedShippingFormatted}</strong>.
            You saved <strong>{savingsFormatted}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={orderUrl} style={{ color: '#7C3AED' }}>View Order →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a shipping discount was automatically applied to your order on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
