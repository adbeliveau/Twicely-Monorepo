import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface ReturnRequestEmailProps {
  sellerName: string;
  orderNumber: string;
  itemTitle: string;
  reason: string;
  description: string;
  responseDueDate: string;
  returnUrl: string;
}

export default function ReturnRequestEmail({
  sellerName,
  orderNumber,
  itemTitle,
  reason,
  description,
  responseDueDate,
  returnUrl,
}: ReturnRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#F59E0B', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Return Requested</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {sellerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            A buyer has requested a return for <strong>{itemTitle}</strong> from order <strong>{orderNumber}</strong>.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Reason: {reason}</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            {description}
          </Text>
          <Text style={{ margin: '0 0 16px', color: '#D97706' }}>
            Please respond by <strong>{responseDueDate}</strong>. If you don&apos;t respond, the return will be automatically approved.
          </Text>
          <Button
            href={returnUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Review Return Request
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because a buyer requested a return on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
