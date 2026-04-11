import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page Not Found — Texas Hold\'em',
  robots: { index: false, follow: false },
};

export default function NotFound(): React.ReactElement {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-6">
      <div aria-hidden="true" className="text-6xl select-none">♠ ♥ ♦ ♣</div>
      <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
        Table Not Found
      </h1>
      <p className="text-[var(--color-text-muted)] max-w-sm leading-relaxed">
        This table has expired, never existed, or the link is incorrect.
        Head back home to create or join a new table.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold bg-[var(--color-felt)] text-[var(--color-text-primary)] hover:bg-[#245a40] transition-colors"
      >
        ♠ Back to Home
      </Link>
    </main>
  );
}
