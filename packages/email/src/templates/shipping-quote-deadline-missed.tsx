import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface ShippingQuoteDeadlineMissedEmailProps {
  orderNumber: string;
  penaltyPercent: string;
  discountedShippingFormatted: string;
  quotesUrl: string;
}

export default function ShippingQuoteDeadlineMissedEmail({
  orderNumber,
  penaltyPercent,
  discountedShippingFormatted,
  quotesUrl,
}: ShippingQuoteDeadlineMissedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Shipping Quote Deadline Missed</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            You did not provide a combined shipping quote for order <strong>{orderNumber}</strong> before the deadline.
            A <strong>{penaltyPercent}%</strong> discount was automatically applied. The buyer now pays{' '}
            <strong>{discountedShippingFormatted}</strong> for shipping.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            You can still submit a lower quote to reduce shipping further.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={quotesUrl} style={{ color: '#7C3AED' }}>Submit Quote →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you missed the combined shipping quote deadline on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
