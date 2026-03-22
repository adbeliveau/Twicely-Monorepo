import { redirect } from 'next/navigation';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import SignupForm from './signup-form';

export default async function SignupPage() {
  const registrationEnabled = await getPlatformSetting<boolean>(
    'general.registrationEnabled',
    true
  );

  if (!registrationEnabled) {
    redirect('/auth/login?error=registration_disabled');
  }

  return <SignupForm />;
}
