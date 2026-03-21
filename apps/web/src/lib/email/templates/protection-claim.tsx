import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface ProtectionClaimEmailProps {
  buyerName: string;
  orderNumber: string;
  claimReason: string;
  reviewDeadline: string;
  claimUrl: string;
}

export default function ProtectionClaimEmail({
  buyerName,
  orderNumber,
  claimReason,
  reviewDeadline,
  claimUrl,
}: ProtectionClaimEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Buyer Protection Claim Received</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {buyerName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            We have received your buyer protection claim for order <strong>{orderNumber}</strong>.
          </Text>
          <Text style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Claim reason:</Text>
          <Text style={{ margin: '0 0 16px', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
            {claimReason}
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            Our team will review your claim and respond by <strong>{reviewDeadline}</strong>.
            You may be asked to provide additional information.
          </Text>
          <Button
            href={claimUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View Claim Status
          </Button>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you filed a buyer protection claim on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
