import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { LobbyActions } from '@/components/ui/lobby-actions';
import { AdUnit } from '@/components/ui/ad-unit';
import { getLocale, getDictionary } from '@/i18n/dictionaries';

export const metadata: Metadata = {
  title: "Texas Hold'em — Play Poker with Friends",
  description:
    "Host or join a Texas Hold'em table. Share a link and play with friends online — no account required.",
};

export default async function HomePage(): Promise<React.ReactElement> {
  const locale = await getLocale();
  const t = await getDictionary(locale);
  const f = t.home.features;

  const features = [
    { icon: '⚡', title: f.realtime.title, desc: f.realtime.desc, href: undefined as string | undefined },
    { icon: '🔒', title: f.private.title, desc: f.private.desc, href: undefined as string | undefined },
    { icon: '🃏', title: f.rules.title, desc: f.rules.desc, href: '/rules' as string | undefined },
  ];

  return (
    <PageContainer className="flex flex-col items-center justify-center px-4 py-16 md:py-24">
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="text-center max-w-2xl mb-12">
        <div aria-hidden="true" className="text-6xl mb-4 select-none">
          ♠ ♥ ♦ ♣
        </div>
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] mb-4 leading-tight"
        >
          {t.home.hero.title}
          <br />
          <span className="text-[var(--color-gold)]">{t.home.hero.subtitle}</span>
        </h1>
        <p className="text-[var(--color-text-muted)] text-lg max-w-md mx-auto leading-relaxed">
          {t.home.hero.body}
        </p>
      </section>

      {/* Lobby actions (Create / Join) */}
      <section aria-labelledby="lobby-heading" className="w-full max-w-xl">
        <h2 id="lobby-heading" className="sr-only">
          Create or Join a Table
        </h2>
        <LobbyActions />
      </section>

      {/* Ad unit */}
      <AdUnit className="w-full max-w-3xl mt-10" />

      {/* Feature highlights */}
      <section
        aria-labelledby="features-heading"
        className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl text-center"
      >
        <h2 id="features-heading" className="sr-only">Features</h2>
        {features.map(({ icon, title, desc, href }) => (
          <article
            key={title}
            className="rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border-muted)] group"
          >
            <div aria-hidden="true" className="text-3xl mb-2">{icon}</div>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{desc}</p>
            {href && (
              <Link
                href={href}
                className="mt-3 inline-flex items-center text-xs font-medium text-[var(--color-gold)] hover:underline"
              >
                {f.rules.link}
              </Link>
            )}
          </article>
        ))}
      </section>
    </PageContainer>
  );
}
