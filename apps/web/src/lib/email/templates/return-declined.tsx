import { Html, Head, Body, Container, Heading, Text, Hr, Button, Link } from '@react-email/components';

interface ReturnDeclinedEmailProps {
  buyerName: string;
  orderNumber: string;
  itemTitle: string;
  declineReason: string;
  escalateUrl: string;
  helpUrl: string;
}

export default function ReturnDeclinedEmail({
  buyerName,
  orderNumber,
  itemTitle,
  declineReason,
  escalateUrl,
  helpUrl,
}: ReturnDeclinedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#EF4444', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Return Request Not Approved</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            Your return request for <strong>{itemTitle}</strong> from order <strong>{orderNumber}</strong> was not approved by the seller.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Seller&apos;s response:</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            {declineReason}
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            If you believe this decision is unfair, you can escalate to Twicely for review. Our team will examine the evidence and make a final decision.
          </Text>
          <Button
            href={escalateUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
              marginRight: 12,
            }}
          >
            Escalate to Twicely
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            Need help? <Link href={helpUrl} style={{ color: '#7C3AED' }}>Contact Support</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
