import { Html, Head, Body, Container, Heading, Text, Hr, Link } from '@react-email/components';

interface Props {
  unsubscribeUrl: string;
}

export default function NewsletterWelcomeEmail({ unsubscribeUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f9f9f9', padding: 20 }}>
        <Container style={{ maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ height: 4, background: '#7C3AED', borderRadius: '8px 8px 0 0', marginBottom: 16 }} />
          <Heading as="h2" style={{ margin: '0 0 16px' }}>You&apos;re on the list</Heading>
          <Text style={{ margin: '0 0 12px' }}>
            Thanks for signing up! You&apos;ll be the first to hear about new features, seller tips, and
            what&apos;s trending on Twicely.
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ fontSize: 12, color: '#666', margin: 0 }}>
            <Link href={unsubscribeUrl} style={{ color: '#666' }}>
              Unsubscribe from marketing emails
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
