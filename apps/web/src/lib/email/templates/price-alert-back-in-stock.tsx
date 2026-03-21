import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface PriceAlertBackInStockEmailProps {
  itemTitle: string;
  listingUrl: string;
}

export default function PriceAlertBackInStockEmail({
  itemTitle,
  listingUrl,
}: PriceAlertBackInStockEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Back in Stock</Heading>
          <Text style={{ margin: '0 0 16px' }}>
            Good news! <strong>{itemTitle}</strong> is back in stock and available to purchase.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={listingUrl} style={{ color: '#7C3AED' }}>View Listing →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you set a back-in-stock alert for this item on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
