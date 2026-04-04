import { Html, Head, Body, Container, Heading, Text, Hr, Link } from '@react-email/components';

interface Props {
  confirmUrl: string;
  unsubscribeUrl: string;
}

export default function NewsletterConfirmationEmail({ confirmUrl, unsubscribeUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>Confirm your email</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            Click the link below to confirm that you want Twicely updates sent to this address.
          </Text>
          <Text style={{ margin: '0 0 12px' }}>
            <Link href={confirmUrl}>Confirm subscription</Link>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            Didn&apos;t request this?{' '}
            <Link href={unsubscribeUrl} style={{ color: '#666' }}>
              Ignore this email or unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
