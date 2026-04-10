import { cn } from '@/lib/utils/cn';
import type { Card, Player } from '@/types/game';
import { CardBack } from './card-back';
import { PlayingCard } from './playing-card';

export type PlayerRowActionTone = 'neutral' | 'call' | 'raise' | 'danger' | 'all-in' | 'winner';

export interface PlayerRowActionBadge {
  label: string;
  tone: PlayerRowActionTone;
}

export interface PlayerRowProps {
  player: Player;
  stack: number;
  isSelf?: boolean;
  isActive?: boolean;
  isWinner?: boolean;
  isDimmed?: boolean;
  actionBadge?: PlayerRowActionBadge | null;
  holeCards?: readonly [Card, Card] | null;
  showHoleCards?: boolean;
  className?: string;
}

const AVATAR_PALETTES = [
  'bg-[#f4a261] text-[#2c1810]',
  'bg-[#7fc8f8] text-[#10263a]',
  'bg-[#d4af37] text-[#2c1810]',
  'bg-[#d27dff] text-[#2c1536]',
  'bg-[#88d498] text-[#133424]',
  'bg-[#ff9f7f] text-[#3d2119]',
] as const;

const ACTION_BADGE_CLASSES: Record<PlayerRowActionTone, string> = {
  neutral: 'bg-white/6 text-[#9dd4ff] border-white/10',
  call: 'bg-[#0d7180]/20 text-[#67d8e8] border-[#2bb5c7]/25',
  raise: 'bg-[#d79a3b]/18 text-[#ffd480] border-[#d79a3b]/30',
  danger: 'bg-[var(--color-danger)]/18 text-[#ff9ba3] border-[var(--color-danger)]/28',
  'all-in': 'bg-[#e07a5f]/18 text-[#ffb7a5] border-[#e07a5f]/30',
  winner: 'bg-[var(--color-gold)]/18 text-[var(--color-gold)] border-[var(--color-gold)]/30',
};

export function PlayerRow({
  player,
  stack,
  isSelf = false,
  isActive = false,
  isWinner = false,
  isDimmed = false,
  actionBadge,
  holeCards = null,
  showHoleCards = false,
  className,
}: PlayerRowProps): React.ReactElement {
  const palette = AVATAR_PALETTES[player.seatIndex % AVATAR_PALETTES.length];
  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || player.name.slice(0, 1).toUpperCase();

  return (
    <article
      aria-label={buildAriaLabel(player.name, stack, { isActive, isWinner, isDimmed, isSelf })}
      className={cn(
        'relative rounded-[28px] border px-3 py-3 transition-all sm:px-4',
        'bg-[#24323b]/88 border-white/8 shadow-[0_16px_40px_rgba(0,0,0,0.16)]',
        isActive && 'border-[#5fb7ff]/35 shadow-[0_0_0_1px_rgba(95,183,255,0.22)]',
        isWinner && 'border-[var(--color-gold)]/30 bg-[#2b302e]/92 shadow-[0_0_0_1px_rgba(212,175,55,0.18)]',
        isDimmed && 'opacity-[0.45]',
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
        <div className="relative shrink-0">
          <div
            aria-hidden="true"
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold sm:h-14 sm:w-14 sm:text-base',
              palette,
              'ring-2',
              isWinner
                ? 'ring-[var(--color-gold)] shadow-[0_0_0_4px_rgba(212,175,55,0.12)]'
                : isActive
                  ? 'ring-[#59b4ff] shadow-[0_0_0_4px_rgba(89,180,255,0.14)]'
                  : 'ring-white/10',
            )}
          >
            {initials}
          </div>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-[#59b4ff] animate-pulse"
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold tracking-[0.01em] text-[var(--color-text-primary)] sm:text-lg">
              {player.name}
            </p>
            {isSelf && (
              <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm tabular-nums text-[#dfe8e4] sm:text-base">
            {formatCurrency(stack)}
          </p>
          {actionBadge && (
            <div className="mt-2 sm:hidden">
              <ActionBadge badge={actionBadge} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          {actionBadge && (
            <div className="hidden sm:block">
              <ActionBadge badge={actionBadge} />
            </div>
          )}
          <div className="flex gap-1.5">
            {showHoleCards && holeCards ? (
              <>
                <PlayingCard card={holeCards[0]} size="sm" />
                <PlayingCard card={holeCards[1]} size="sm" />
              </>
            ) : (
              <>
                <CardBack size="sm" />
                <CardBack size="sm" />
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

interface BuildAriaLabelOptions {
  isActive: boolean;
  isWinner: boolean;
  isDimmed: boolean;
  isSelf: boolean;
}

function buildAriaLabel(name: string, stack: number, options: BuildAriaLabelOptions): string {
  const parts = [name, `${formatCurrency(stack)} chips`];

  if (options.isSelf) {
    parts.push('you');
  }
  if (options.isWinner) {
    parts.push('winner');
  } else if (options.isActive) {
    parts.push('active turn');
  } else if (options.isDimmed) {
    parts.push('folded or out this hand');
  }

  return parts.join(', ');
}

function ActionBadge({ badge }: { badge: PlayerRowActionBadge }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase',
        ACTION_BADGE_CLASSES[badge.tone],
      )}
    >
      {badge.label}
    </span>
  );
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}