import { cn } from '@/lib/utils/cn';
import type { Card, Player } from '@/types/game';
import { ChipStack } from '@/components/game/chip-stack';
import { PlayingCard } from '@/components/game/playing-card';
import { CardBack } from '@/components/game/card-back';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const AVATAR_ANIMALS = ['🦊', '🐻', '🐯', '🦁', '🐼', '🐺', '🦝', '🦅', '🦉'] as const;
const AVATAR_PALETTES = [
  'bg-[var(--color-felt)]',
  'bg-[#7a3b1e]',
  'bg-[#5a3200]',
  'bg-[#1a3d2b]',
  'bg-[#2c1048]',
  'bg-[#1e3a5f]',
  'bg-[#3d2b00]',
  'bg-[#1a2b1a]',
  'bg-[#2c1810]',
] as const;

export interface GameEndScreenProps {
  players: Record<string, Player>;
  winnerPlayerId?: string | null;
  tableId: string;
  finalGameState?: {
    communityCards: readonly Card[];
    playerHands: Record<string, { holeCards: readonly [Card, Card] } | undefined>;
  } | null;
  className?: string;
}

/**
 * Full-screen game over overlay with final standings and optional card reveal.
 */
export function GameEndScreen({ players, winnerPlayerId, tableId, finalGameState, className }: GameEndScreenProps): React.ReactElement {
  const sorted = Object.values(players).sort((a, b) => b.chips - a.chips);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/80 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'w-full max-w-lg mx-auto rounded-3xl p-6',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
          'flex flex-col gap-5 max-h-[90dvh] overflow-y-auto',
        )}
      >
        {/* Header */}
        <div className="text-center">
          <p aria-hidden="true" className="text-4xl mb-2">🏆</p>
          <h2 className="text-2xl font-bold text-[var(--color-gold)]">Game Over</h2>
          {winnerPlayerId && players[winnerPlayerId] && (
            <p className="text-[var(--color-text-muted)] mt-1">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {players[winnerPlayerId].name}
              </span>{' '}
              wins!
            </p>
          )}
        </div>

        {/* Card reveal */}
        {finalGameState && (
          <section aria-labelledby="cards-heading" className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-canvas)] p-4">
            <h3
              id="cards-heading"
              className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3"
            >
              Final Board
            </h3>
            {/* Community cards */}
            <div className="flex flex-wrap gap-1.5 justify-center mb-4">
              {Array.from({ length: 5 }).map((_, i) => {
                const card = finalGameState.communityCards[i];
                return card
                  ? <PlayingCard key={i} card={card} size="sm" />
                  : <CardBack key={i} size="sm" className="opacity-30" />;
              })}
            </div>
            {/* Player hands */}
            <div className="flex flex-col gap-2">
              {sorted.map((player) => {
                const hand = finalGameState.playerHands[player.id];
                const animal = AVATAR_ANIMALS[player.seatIndex % AVATAR_ANIMALS.length];
                return (
                  <div key={player.id} className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden="true">{animal}</span>
                    <span className="text-sm text-[var(--color-text-muted)] min-w-[60px] truncate">{player.name}</span>
                    <div className="flex gap-1">
                      {hand?.holeCards
                        ? hand.holeCards.map((card, ci) => <PlayingCard key={ci} card={card} size="sm" />)
                        : <>
                            <CardBack size="sm" className="opacity-40" />
                            <CardBack size="sm" className="opacity-40" />
                          </>
                      }
                    </div>
                    {player.id === winnerPlayerId && (
                      <span className="text-xs font-semibold text-[var(--color-gold)] ml-auto">👑 Winner</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Final standings */}
        <section aria-labelledby="standings-heading">
          <h3
            id="standings-heading"
            className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3"
          >
            Final Standings
          </h3>
          <ol className="flex flex-col gap-2">
            {sorted.map((player, i) => {
              const animal = AVATAR_ANIMALS[player.seatIndex % AVATAR_ANIMALS.length];
              const palette = AVATAR_PALETTES[player.seatIndex % AVATAR_PALETTES.length];
              return (
                <li
                  key={player.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-canvas)]"
                >
                  <span className="text-sm font-bold text-[var(--color-text-muted)] w-4 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0', palette)}>
                    {animal}
                  </div>
                  <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {player.name}
                  </span>
                  {player.id === winnerPlayerId && (
                    <Badge variant="gold">Winner</Badge>
                  )}
                  <ChipStack amount={player.chips} inline />
                </li>
              );
            })}
          </ol>
        </section>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold bg-[var(--color-border-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
          >
            Home
          </Link>
          <Link
            href={`/table/${tableId}?reset=1`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold bg-[var(--color-felt)] text-[var(--color-text-primary)] hover:bg-[#245a40] transition-colors"
          >
            Play Again
          </Link>
        </div>
      </div>
    </div>
  );
}
