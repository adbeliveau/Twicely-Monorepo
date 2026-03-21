import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface OfferReceivedEmailProps {
  sellerName: string;
  itemTitle: string;
  offerAmountFormatted: string;
  offersUrl: string;
}

export default function OfferReceivedEmail({
  sellerName,
  itemTitle,
  offerAmountFormatted,
  offersUrl,
}: OfferReceivedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>New Offer Received</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {sellerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            You have a new offer of <strong>{offerAmountFormatted}</strong> on <strong>{itemTitle}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            Review and respond to this offer before it expires.
          </Text>
          <Button
            href={offersUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Offers
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because someone made an offer on your listing.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
