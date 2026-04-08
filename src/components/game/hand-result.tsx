import { cn } from '@/lib/utils/cn';
import type { HandRank } from '@/types/game';

const HAND_RANK_NAMES: Record<HandRank, string> = {
  1: 'High Card',
  2: 'One Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush',
  10: 'Royal Flush',
};

export interface HandResultProps {
  rank: HandRank;
  description?: string;
  isWinner?: boolean;
  className?: string;
}

/**
 * Displays a player's hand result (e.g. "Full House" or "Royal Flush").
 */
export function HandResult({ rank, description, isWinner, className }: HandResultProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-1.5',
        isWinner
          ? 'bg-[var(--color-gold)]/20 border border-[var(--color-gold)]/40'
          : 'bg-[var(--color-surface)] border border-[var(--color-border-muted)]',
        className,
      )}
      aria-label={description ? `${HAND_RANK_NAMES[rank]}: ${description}` : HAND_RANK_NAMES[rank]}
    >
      {isWinner && (
        <span aria-hidden="true" className="text-[var(--color-gold)]">★</span>
      )}
      <div className="flex flex-col">
        <span
          className={cn(
            'text-xs font-bold',
            isWinner ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-primary)]',
          )}
        >
          {HAND_RANK_NAMES[rank]}
        </span>
        {description && (
          <span className="text-xs text-[var(--color-text-muted)]">{description}</span>
        )}
      </div>
    </div>
  );
}
