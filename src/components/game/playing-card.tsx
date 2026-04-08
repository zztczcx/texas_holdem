import { cn } from '@/lib/utils/cn';
import type { Card, Suit } from '@/types/game';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: 'text-[var(--color-suit-dark)]',
  clubs: 'text-[var(--color-suit-dark)]',
  hearts: 'text-[var(--color-suit-red)]',
  diamonds: 'text-[var(--color-suit-red)]',
};

export interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-9 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-base',
};

const rankSizeClasses = {
  sm: 'text-sm font-bold',
  md: 'text-base font-bold',
  lg: 'text-xl font-bold',
};

const centerSizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export function PlayingCard({ card, size = 'md', className }: PlayingCardProps): React.ReactElement {
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];

  return (
    <article
      aria-label={`${card.rank} of ${card.suit}`}
      className={cn(
        'relative bg-[var(--color-card-bg)] rounded-lg border border-[#e0d5c8]',
        'shadow-[0_2px_8px_rgba(0,0,0,0.3)] select-none',
        'flex flex-col justify-between p-1',
        sizeClasses[size],
        className,
      )}
    >
      {/* Top-left rank + suit */}
      <div className={cn('leading-none', rankSizeClasses[size], suitColor)}>
        <div>{card.rank === '10' ? '10' : card.rank}</div>
        <div className="text-[0.7em]">{suitSymbol}</div>
      </div>

      {/* Center suit */}
      <div className={cn('absolute inset-0 flex items-center justify-center', centerSizeClasses[size], suitColor)}>
        {suitSymbol}
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div className={cn('leading-none rotate-180 self-end', rankSizeClasses[size], suitColor)}>
        <div>{card.rank === '10' ? '10' : card.rank}</div>
        <div className="text-[0.7em]">{suitSymbol}</div>
      </div>
    </article>
  );
}
