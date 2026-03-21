import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface OfferExpiredEmailProps {
  buyerName: string;
  itemTitle: string;
  offerAmountFormatted: string;
  listingUrl: string;
}

export default function OfferExpiredEmail({
  buyerName,
  itemTitle,
  offerAmountFormatted,
  listingUrl,
}: OfferExpiredEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Offer Expired</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            Your offer of {offerAmountFormatted} on <strong>{itemTitle}</strong> has expired without a response.
            Your payment hold has been released.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={listingUrl} style={{ color: '#7C3AED' }}>Make a new offer →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because your offer expired on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
