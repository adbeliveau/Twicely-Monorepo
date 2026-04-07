import Link from 'next/link';
import { SkipNav } from '@/components/shared/skip-nav';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tw-fullwidth min-h-screen bg-[var(--tw-bg)] flex flex-col">
      <SkipNav />

      {/* Top bar */}
      <header className="bg-white border-b border-[var(--tw-border)]">
        <div className="mx-auto max-w-[1380px] px-7 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight text-[var(--tw-black)]">
            Twicely<span className="text-[var(--mg)]">.</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-extrabold text-[var(--tw-muted)] hover:text-[var(--tw-black)]"
          >
            &larr; Back to home
          </Link>
        </div>
      </header>

      {/* Centered card */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--tw-border)] bg-white">
        <div className="mx-auto max-w-[1380px] px-7 h-14 flex items-center justify-center text-xs text-[var(--tw-muted-lt)]">
          &copy; {new Date().getFullYear()} Twicely. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
