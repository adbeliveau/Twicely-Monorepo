import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface ShippingQuoteRequestedEmailProps {
  orderNumber: string;
  itemCount: string;
  deadlineFormatted: string;
  maxShippingFormatted: string;
  quotesUrl: string;
}

export default function ShippingQuoteRequestedEmail({
  orderNumber,
  itemCount,
  deadlineFormatted,
  maxShippingFormatted,
  quotesUrl,
}: ShippingQuoteRequestedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Shipping Quote Requested</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            Order <strong>{orderNumber}</strong> contains <strong>{itemCount}</strong> items. Please provide a combined shipping quote before{' '}
            <strong>{deadlineFormatted}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            Maximum shipping allowed: <strong>{maxShippingFormatted}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={quotesUrl} style={{ color: '#7C3AED' }}>Submit Quote →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a buyer placed a combined order on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
