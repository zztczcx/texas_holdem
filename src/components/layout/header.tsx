import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { LangSwitcher } from '@/components/layout/lang-switcher';
import { getLocale, getDictionary } from '@/i18n/dictionaries';

export async function Header({ className }: { className?: string }): Promise<React.ReactElement> {
  const locale = await getLocale();
  const t = await getDictionary(locale);

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
        <span className="text-lg font-bold tracking-tight">{t.header.title}</span>
      </Link>

      <nav aria-label="Main navigation" className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t.header.nav.home}
        </Link>
        <Link
          href="/rules"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t.header.nav.rules}
        </Link>
        <LangSwitcher />
      </nav>
    </header>
  );
}
