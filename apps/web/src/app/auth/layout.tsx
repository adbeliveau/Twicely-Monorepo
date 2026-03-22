import { SkipNav } from '@/components/shared/skip-nav';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <SkipNav />
      <div id="main-content" tabIndex={-1} className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
