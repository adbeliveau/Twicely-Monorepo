import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface WatcherOfferEmailProps {
  recipientName: string;
  itemTitle: string;
  originalPriceFormatted: string;
  discountedPriceFormatted: string;
  listingUrl: string;
}

export default function WatcherOfferEmail({
  recipientName,
  itemTitle,
  originalPriceFormatted,
  discountedPriceFormatted,
  listingUrl,
}: WatcherOfferEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Special Offer Just for You!</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            The seller of <strong>{itemTitle}</strong> is offering you an exclusive discount!
          </Text>
          <Text style={{ margin: '0 0 16px', fontSize: 18 }}>
            <span style={{ textDecoration: 'line-through', color: '#666' }}>{originalPriceFormatted}</span>
            {' '}
            <strong style={{ color: '#16a34a' }}>{discountedPriceFormatted}</strong>
          </Text>
          <Text style={{ margin: '0 0 16px', color: '#666', fontSize: 14 }}>
            This special offer is available for 48 hours. Don&apos;t miss out!
          </Text>
          <Button
            href={listingUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Listing
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you&apos;re watching this item on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
