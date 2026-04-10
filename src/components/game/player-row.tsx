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
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  currentRoundBet?: number;
  actionBadge?: PlayerRowActionBadge | null;
  holeCards?: readonly [Card, Card] | null;
  showHoleCards?: boolean;
  className?: string;
}

// Deterministic animal emoji per seat — warm, playful, poker-themed
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

const ACTION_BADGE_CLASSES: Record<PlayerRowActionTone, string> = {
  neutral: 'bg-[var(--color-border-muted)]/70 text-[var(--color-text-muted)] border-[var(--color-border)]',
  call: 'bg-[var(--color-felt)]/18 text-[var(--color-text-primary)] border-[var(--color-felt)]/35',
  raise: 'bg-[var(--color-gold)]/14 text-[var(--color-gold)] border-[var(--color-gold)]/30',
  danger: 'bg-[var(--color-danger)]/18 text-[var(--color-danger)] border-[var(--color-danger)]/28',
  'all-in': 'bg-[var(--color-gold)]/18 text-[var(--color-gold)] border-[var(--color-gold)]/34',
  winner: 'bg-[var(--color-gold)]/18 text-[var(--color-gold)] border-[var(--color-gold)]/30',
};

export function PlayerRow({
  player,
  stack,
  isSelf = false,
  isActive = false,
  isWinner = false,
  isDimmed = false,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  currentRoundBet,
  actionBadge,
  holeCards = null,
  showHoleCards = false,
  className,
}: PlayerRowProps): React.ReactElement {
  const palette = AVATAR_PALETTES[player.seatIndex % AVATAR_PALETTES.length];
  const animal = AVATAR_ANIMALS[player.seatIndex % AVATAR_ANIMALS.length];

  return (
    <article
      aria-label={buildAriaLabel(player.name, stack, { isActive, isWinner, isDimmed, isSelf })}
      className={cn(
        'relative rounded-[28px] border px-3 py-3 transition-all sm:px-4',
        'bg-[var(--color-surface)] border-[var(--color-border-muted)] shadow-[0_4px_16px_rgba(0,0,0,0.4)]',
        isActive && 'border-[var(--color-focus)]/40 shadow-[0_0_0_1px_rgba(67,97,238,0.24)]',
        isWinner && 'border-[var(--color-gold)]/30 bg-[var(--color-felt-dark)]/80 shadow-[0_0_0_1px_rgba(212,175,55,0.18)]',
        isDimmed && 'opacity-[0.45]',
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
        <div className="relative shrink-0">
          <div
            aria-hidden="true"
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-2xl sm:h-14 sm:w-14 sm:text-3xl',
              palette,
              'ring-2',
              isWinner
                ? 'ring-[var(--color-gold)] shadow-[0_0_0_4px_rgba(212,175,55,0.12)]'
                : isActive
                  ? 'ring-[var(--color-focus)] shadow-[0_0_0_4px_rgba(67,97,238,0.14)]'
                  : 'ring-[var(--color-border)]/60',
            )}
          >
            <span>{animal}</span>
          </div>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-[var(--color-focus)] animate-pulse"
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-base font-semibold tracking-[0.01em] text-[var(--color-text-primary)] sm:text-lg">
              {player.name}
            </p>
            {isSelf && (
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-border-muted)]/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                You
              </span>
            )}
            {isDealer && (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)] text-[9px] font-bold text-[var(--color-text-on-light)]">
                D
              </span>
            )}
            {isSmallBlind && (
              <span className="rounded-full border border-[var(--color-felt)] bg-[var(--color-felt)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-felt)]">
                SB
              </span>
            )}
            {isBigBlind && (
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-border-muted)]/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                BB
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-sm tabular-nums text-[var(--color-text-primary)] sm:text-base">
              {formatCurrency(stack)}
            </p>
            {currentRoundBet != null && currentRoundBet > 0 && (
              <p className="text-xs tabular-nums text-[var(--color-gold)]">
                +{formatCurrency(currentRoundBet)}
              </p>
            )}
          </div>
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