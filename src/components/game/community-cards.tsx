import { cn } from '@/lib/utils/cn';
import type { Card } from '@/types/game';
import { CardBack } from './card-back';
import { PlayingCard } from './playing-card';

export interface CommunityCardsProps {
  cards: readonly Card[];
  className?: string;
}

const TOTAL_SLOTS = 5;

/**
 * Displays the 5 community card slots (flop/turn/river).
 * Unrevealed slots show face-down placeholders.
 */
export function CommunityCards({ cards, className }: CommunityCardsProps): React.ReactElement {
  return (
    <div
      aria-label={`Community cards: ${cards.length} of ${TOTAL_SLOTS} revealed`}
      className={cn(
        'flex items-center gap-2 p-3 rounded-xl',
        'bg-[var(--color-felt-dark)]/40',
        className,
      )}
    >
      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
        const card = cards[i];
        if (card) {
          return <PlayingCard key={i} card={card} size="md" />;
        }
        return <CardBack key={i} size="md" className="opacity-95" />;
      })}
    </div>
  );
}
