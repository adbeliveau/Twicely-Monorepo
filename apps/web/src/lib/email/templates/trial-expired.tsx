import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface TrialExpiredEmailProps {
  recipientName: string;
  productName: string;
  upgradeUrl: string;
}

export default function TrialExpiredEmail({
  recipientName,
  productName,
  upgradeUrl,
}: TrialExpiredEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Your trial has ended</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            Your free trial of <strong>{productName}</strong> has ended. Your account has been
            downgraded to the free tier.
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            Your data and settings are still saved. Upgrade anytime to restore access to all {productName} features.
          </Text>
          <Button
            href={upgradeUrl}
            style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
              fontWeight: 'bold',
            }}
          >
            Upgrade Now
          </Button>
          <Text style={{ margin: '16px 0 0', fontSize: 14, color: '#666' }}>
            Questions about our plans? Reply to this email or visit our pricing page.
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because your free trial on Twicely has ended.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
