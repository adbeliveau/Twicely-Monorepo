import { Html, Head, Body, Container, Heading, Text, Hr, Button } from '@react-email/components';

interface TrialEndingEmailProps {
  recipientName: string;
  productName: string;
  daysRemaining: number;
  trialEndDate: string;
  upgradeUrl: string;
}

export default function TrialEndingEmail({
  recipientName,
  productName,
  daysRemaining,
  trialEndDate,
  upgradeUrl,
}: TrialEndingEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Your trial ends soon</Heading>
          <Text style={{ margin: '0 0 12px' }}>Hi {recipientName},</Text>
          <Text style={{ margin: '0 0 12px' }}>
            Your free trial of <strong>{productName}</strong> ends in{' '}
            <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong> (on {trialEndDate}).
          </Text>
          <Text style={{ margin: '0 0 16px' }}>
            To continue enjoying all the features of {productName}, add a payment method before your trial ends.
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
            Continue with {productName}
          </Button>
          <Text style={{ margin: '16px 0 0', fontSize: 14, color: '#666' }}>
            If you don&apos;t add a payment method, your account will be downgraded to the free tier when your trial ends.
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            You received this because you started a free trial on Twicely.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
