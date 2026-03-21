import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface OfferCounteredEmailProps {
  recipientName: string;
  itemTitle: string;
  counterAmountFormatted: string;
  offersUrl: string;
}

export default function OfferCounteredEmail({
  recipientName,
  itemTitle,
  counterAmountFormatted,
  offersUrl,
}: OfferCounteredEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Counter Offer</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            You received a counter offer of <strong>{counterAmountFormatted}</strong> on <strong>{itemTitle}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            Accept, decline, or counter before the offer expires.
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
            View Offer
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you&apos;re negotiating an offer on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
