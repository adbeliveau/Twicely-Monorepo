import { SkipNav } from '@/components/shared/skip-nav';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SkipNav />
      <div id="main-content" tabIndex={-1} className="w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}
