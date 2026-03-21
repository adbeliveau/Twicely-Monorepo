import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface ShippingQuoteDisputedEmailProps {
  orderNumber: string;
  buyerName: string;
  supportUrl: string;
}

export default function ShippingQuoteDisputedEmail({
  orderNumber,
  buyerName,
  supportUrl,
}: ShippingQuoteDisputedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Shipping Quote Disputed</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            <strong>{buyerName}</strong> disputed your combined shipping quote for order{' '}
            <strong>{orderNumber}</strong>. Twicely support will review the dispute and contact you.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={supportUrl} style={{ color: '#7C3AED' }}>Contact Support →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a buyer disputed your shipping quote on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
