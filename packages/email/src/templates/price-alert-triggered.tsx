import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface PriceAlertTriggeredEmailProps {
  itemTitle: string;
  oldPriceCents: string;
  newPriceCents: string;
  listingUrl: string;
}

function formatCents(cents: string): string {
  const num = parseInt(cents, 10);
  if (isNaN(num)) return cents;
  return `$${(num / 100).toFixed(2)}`;
}

export default function PriceAlertTriggeredEmail({
  itemTitle,
  oldPriceCents,
  newPriceCents,
  listingUrl,
}: PriceAlertTriggeredEmailProps) {
  const oldFormatted = formatCents(oldPriceCents);
  const newFormatted = formatCents(newPriceCents);
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Price Alert Triggered</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            The price on <strong>{itemTitle}</strong> dropped from{' '}
            <span style={{ textDecoration: 'line-through', color: '#666' }}>{oldFormatted}</span> to{' '}
            <strong style={{ color: '#16a34a' }}>{newFormatted}</strong> — your alert triggered.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={listingUrl} style={{ color: '#7C3AED' }}>View Listing →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you set a price alert for this item on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
