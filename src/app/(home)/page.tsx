import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { LobbyActions } from '@/components/ui/lobby-actions';

export const metadata: Metadata = {
  title: "Texas Hold'em — Play Poker with Friends",
  description:
    "Host or join a Texas Hold'em table. Share a link and play with friends online — no account required.",
};

export default function HomePage(): React.ReactElement {
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
          Play Texas Hold&apos;em
          <br />
          <span className="text-[var(--color-gold)]">with Friends</span>
        </h1>
        <p className="text-[var(--color-text-muted)] text-lg max-w-md mx-auto leading-relaxed">
          Create a private table and share the link. No account required — just pick a
          name and start playing.
        </p>
      </section>

      {/* Lobby actions (Create / Join) */}
      <section aria-labelledby="lobby-heading" className="w-full max-w-xl">
        <h2 id="lobby-heading" className="sr-only">
          Create or Join a Table
        </h2>
        <LobbyActions />
      </section>

      {/* Feature highlights */}
      <section
        aria-labelledby="features-heading"
        className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl text-center"
      >
        <h2 id="features-heading" className="sr-only">Features</h2>
        {[
          { icon: '⚡', title: 'Real-Time', desc: 'Live updates via WebSockets — see every action instantly.' },
          { icon: '🔒', title: 'Private Tables', desc: 'Share a 6-character code. Only invited players join.' },
          { icon: '🃏', title: 'Full Rules', desc: 'Blinds, side pots, all-in, buy-backs — complete Hold\'em.' },
        ].map(({ icon, title, desc }) => (
          <article
            key={title}
            className="rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border-muted)]"
          >
            <div aria-hidden="true" className="text-3xl mb-2">{icon}</div>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{desc}</p>
          </article>
        ))}
      </section>
    </PageContainer>
  );
}
