'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/layout/i18n-provider';

export function LangSwitcher(): React.ReactElement {
  const router = useRouter();
  const { locale } = useI18n();

  function handleToggle(): void {
    const next = locale === 'en' ? 'zh' : 'en';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={locale === 'en' ? 'Switch to Chinese' : '切换到英文'}
      className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--color-border-muted)]"
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
