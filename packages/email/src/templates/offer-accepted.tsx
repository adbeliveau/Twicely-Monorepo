import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface OfferAcceptedEmailProps {
  buyerName: string;
  itemTitle: string;
  offerAmountFormatted: string;
  orderUrl: string;
}

export default function OfferAcceptedEmail({
  buyerName,
  itemTitle,
  offerAmountFormatted,
  orderUrl,
}: OfferAcceptedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Offer Accepted!</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            Great news! Your offer of {offerAmountFormatted} on <strong>{itemTitle}</strong> has been accepted.
            Your payment has been processed and the seller will ship your item soon.
          </Text>
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
            You received this because your offer was accepted on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
