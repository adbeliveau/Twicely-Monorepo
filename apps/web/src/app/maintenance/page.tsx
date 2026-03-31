import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Maintenance | Twicely',
  description: 'Twicely is temporarily unavailable for maintenance.',
};

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">We'll be right back</h1>
        <p className="text-gray-600">
          Twicely is temporarily unavailable while we perform scheduled maintenance.
          We expect to be back shortly.
        </p>
        <p className="text-sm text-gray-400">
          If you need immediate help, email{' '}
          <a href="mailto:support@twicely.co" className="text-primary hover:underline">
            support@twicely.co
          </a>
        </p>
      </div>
    </div>
  );
}
