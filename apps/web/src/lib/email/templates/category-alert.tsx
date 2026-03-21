import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components';

interface CategoryAlertEmailProps {
  recipientName: string;
  categoryName: string;
  itemTitle: string;
  priceFormatted: string;
  listingUrl: string;
}

export default function CategoryAlertEmail({
  recipientName,
  categoryName,
  itemTitle,
  priceFormatted,
  listingUrl,
}: CategoryAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>New Listing in {categoryName}</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            A new item matching your alert was just listed: <strong>{itemTitle}</strong> for{' '}
            <strong style={{ color: '#16a34a' }}>{priceFormatted}</strong>.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            <Link href={listingUrl} style={{ color: '#7C3AED' }}>View listing →</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you set an alert for {categoryName} on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
