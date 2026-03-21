import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface OfferDeclinedEmailProps {
  buyerName: string;
  itemTitle: string;
  offerAmountFormatted: string;
  listingUrl: string;
}

export default function OfferDeclinedEmail({
  buyerName,
  itemTitle,
  offerAmountFormatted,
  listingUrl,
}: OfferDeclinedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Offer Not Accepted</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            The seller accepted another offer on <strong>{itemTitle}</strong>. Your offer of {offerAmountFormatted} has
            been released — no charge to your card.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={listingUrl} style={{ color: '#7C3AED' }}>Browse similar items →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you made an offer on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
