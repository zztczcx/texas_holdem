import { cn } from '@/lib/utils/cn';
import type { Player } from '@/types/game';
import { ChipStack } from '@/components/game/chip-stack';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export interface GameEndScreenProps {
  players: Record<string, Player>;
  winnerPlayerId?: string | null;
  tableId: string;
  className?: string;
}

/**
 * Full-screen game over overlay with final standings.
 */
export function GameEndScreen({ players, winnerPlayerId, tableId, className }: GameEndScreenProps): React.ReactElement {
  const sorted = Object.values(players).sort((a, b) => b.chips - a.chips);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/80 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'w-full max-w-md mx-4 rounded-3xl p-6',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
          'flex flex-col gap-5',
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

        {/* Final standings */}
        <section aria-labelledby="standings-heading">
          <h3
            id="standings-heading"
            className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3"
          >
            Final Standings
          </h3>
          <ol className="flex flex-col gap-2">
            {sorted.map((player, i) => (
              <li
                key={player.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-canvas)]"
              >
                <span className="text-sm font-bold text-[var(--color-text-muted)] w-4 text-center">
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-[var(--color-felt)] flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)] shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {player.name}
                </span>
                {player.id === winnerPlayerId && (
                  <Badge variant="gold">Winner</Badge>
                )}
                <ChipStack amount={player.chips} inline />
              </li>
            ))}
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
            href={`/table/${tableId}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold bg-[var(--color-felt)] text-[var(--color-text-primary)] hover:bg-[#245a40] transition-colors"
          >
            Play Again
          </Link>
        </div>
      </div>
    </div>
  );
}
