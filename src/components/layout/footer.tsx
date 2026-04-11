import { getDictionary, getLocale } from '@/i18n/dictionaries';

export async function Footer(): Promise<React.ReactElement> {
  const locale = await getLocale();
  const t = await getDictionary(locale);

  return (
    <footer className="mt-auto border-t border-[var(--color-border-muted)] py-6 text-center">
      <p className="text-sm text-[var(--color-text-muted)]">
        {t.footer.copyright}
      </p>
    </footer>
  );
}
