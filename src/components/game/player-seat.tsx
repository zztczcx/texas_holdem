import { cn } from '@/lib/utils/cn';
import type { Player, GameState } from '@/types/game';
import { CardBack } from './card-back';
import { PlayingCard } from './playing-card';
import { ChipStack } from './chip-stack';

export interface PlayerSeatProps {
  player: Player;
  gameState: Omit<GameState, 'deck'> & { deck: null };
  /** The seat's position label: 'dealer' | 'sb' | 'bb' | null */
  role?: 'dealer' | 'sb' | 'bb' | null;
  /** Whether it's this player's turn */
  isActive?: boolean;
  /** Whether this is the current viewer's seat */
  isSelf?: boolean;
  className?: string;
}

const ROLE_LABELS: Record<'dealer' | 'sb' | 'bb', string> = {
  dealer: 'D',
  sb: 'SB',
  bb: 'BB',
};

const ROLE_CLASSES: Record<'dealer' | 'sb' | 'bb', string> = {
  dealer: 'bg-[var(--color-gold)] text-[var(--color-text-on-light)]',
  sb: 'bg-[var(--color-felt)] text-[var(--color-text-primary)]',
  bb: 'bg-[var(--color-felt)] text-[var(--color-text-primary)]',
};

/**
 * A single player seat on the poker table — shows avatar, name, chips,
 * hole cards, role badges, and active/folded state.
 */
export function PlayerSeat({
  player,
  gameState,
  role,
  isActive,
  isSelf,
  className,
}: PlayerSeatProps): React.ReactElement {
  const isFolded = player.status === 'folded';
  const isAllIn = player.status === 'allIn';
  const hand = gameState.playerHands[player.id];
  const betInRound = gameState.bettingRound.bets[player.id] ?? 0;

  return (
    <article
      aria-label={`${player.name}, ${player.chips} chips${isActive ? ', their turn' : ''}${isFolded ? ', folded' : ''}`}
      className={cn(
        'relative flex flex-col items-center gap-1',
        'rounded-2xl p-2 min-w-[80px]',
        'bg-[var(--color-surface)] border',
        isActive
          ? 'border-[var(--color-gold)] shadow-[0_0_12px_rgba(212,175,55,0.4)]'
          : 'border-[var(--color-border-muted)]',
        isFolded && 'opacity-50',
        isSelf && 'ring-2 ring-[var(--color-focus)] ring-offset-1 ring-offset-[var(--color-canvas)]',
        className,
      )}
    >
      {/* Role badge */}
      {role && (
        <span
          aria-label={role}
          className={cn(
            'absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center z-10',
            ROLE_CLASSES[role],
          )}
        >
          {ROLE_LABELS[role]}
        </span>
      )}

      {/* Active turn indicator ring */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute -inset-0.5 rounded-2xl border-2 border-[var(--color-gold)] animate-pulse pointer-events-none"
        />
      )}

      {/* Avatar */}
      <div
        aria-hidden="true"
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'text-sm font-bold text-[var(--color-text-primary)]',
          isActive ? 'bg-[var(--color-gold)] text-[var(--color-text-on-light)]' : 'bg-[var(--color-felt)]',
        )}
      >
        {player.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate max-w-[72px] text-center">
        {player.name}
        {isSelf && <span className="text-[var(--color-text-muted)]"> (you)</span>}
      </p>

      {/* Chip count */}
      <ChipStack amount={player.chips} inline />

      {/* Current bet in this round */}
      {betInRound > 0 && (
        <span className="tabular-nums text-xs text-[var(--color-text-muted)]">
          bet {betInRound.toLocaleString()}
        </span>
      )}

      {/* All-in indicator */}
      {isAllIn && (
        <span className="text-xs font-bold text-[var(--color-gold)] uppercase tracking-wide">
          All-in
        </span>
      )}

      {/* Hole cards (mini) */}
      <div className="flex gap-0.5 mt-0.5" aria-label={isSelf && hand ? 'Your cards' : 'Cards'}>
        {hand?.holeCards ? (
          <>
            <PlayingCard card={hand.holeCards[0]} size="sm" />
            <PlayingCard card={hand.holeCards[1]} size="sm" />
          </>
        ) : (
          !isFolded && (
            <>
              <CardBack size="sm" />
              <CardBack size="sm" />
            </>
          )
        )}
      </div>
    </article>
  );
}
