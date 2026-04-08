import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export function Header({ className }: { className?: string }): React.ReactElement {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between',
        'px-4 py-3 md:px-8',
        'bg-[var(--color-canvas)]/90 backdrop-blur-sm',
        'border-b border-[var(--color-border-muted)]',
        className,
      )}
    >
      <Link
        href="/"
        className="flex items-center gap-2 text-[var(--color-text-primary)] no-underline"
        aria-label="Texas Hold'em — Home"
      >
        <span aria-hidden="true" className="text-2xl">♠</span>
        <span className="text-lg font-bold tracking-tight">Hold&apos;em</span>
      </Link>

      <nav aria-label="Main navigation">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Home
        </Link>
      </nav>
    </header>
  );
}
