'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { HandEndResult, WinnerResult, Card, HandRank } from '@/types/game';
import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/game/playing-card';

export interface ShowdownOverlayProps {
  result: HandEndResult;
  /** Map of playerId → player name */
  playerNames: Record<string, string>;
  allowBuyBack?: boolean;
  currentPlayerId?: string | null;
  currentPlayerChips?: number;
  onNextHand?: () => void;
  onBuyBack?: () => Promise<void>;
  className?: string;
}

const COUNTDOWN_SECONDS = 8;

const HAND_RANK_LABELS: Record<HandRank, string> = {
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

// Color gradient per hand rank (1=worst, 10=best)
const HAND_RANK_COLORS: Record<HandRank, string> = {
  1:  'bg-[#3a3a3a] text-[#aaa] border-[#555]',
  2:  'bg-[#1a3a5c] text-[#7eb8f7] border-[#2a5c8a]',
  3:  'bg-[#1a3a5c] text-[#7eb8f7] border-[#2a5c8a]',
  4:  'bg-[#2a1a5c] text-[#b07ef7] border-[#4a2a8a]',
  5:  'bg-[#1a4a2a] text-[#7ef7b0] border-[#2a7a4a]',
  6:  'bg-[#1a4a2a] text-[#7ef7b0] border-[#2a7a4a]',
  7:  'bg-[#4a2a1a] text-[#f7b07e] border-[#7a4a2a]',
  8:  'bg-[#4a3a00] text-[#f7d47e] border-[#7a6a00]',
  9:  'bg-[#3a1a1a] text-[#f77e7e] border-[#7a2a2a]',
  10: 'bg-[var(--color-gold)]/20 text-[var(--color-gold)] border-[var(--color-gold)]/60',
};

/**
 * Full-screen showdown overlay — winner announcement, hand details,
 * pot distribution, and per-player chip summary.
 */
export function ShowdownOverlay({
  result,
  playerNames,
  allowBuyBack,
  currentPlayerId,
  currentPlayerChips = 0,
  onNextHand,
  onBuyBack,
  className,
}: ShowdownOverlayProps): React.ReactElement {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [buyBackPending, setBuyBackPending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      onNextHand?.();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, onNextHand]);

  const winnerIds = new Set(result.winners.map((w) => w.playerId));
  const isCurrentPlayerWinner = currentPlayerId ? winnerIds.has(currentPlayerId) : false;
  const isBrokeOut = currentPlayerId && currentPlayerChips === 0;
  const isSplitPot = result.winners.length > 1;

  async function handleBuyBack(): Promise<void> {
    setBuyBackPending(true);
    try {
      await onBuyBack?.();
    } finally {
      setBuyBackPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hand result"
      className={cn(
        'fixed inset-0 z-40 flex items-end sm:items-center justify-center',
        'bg-black/75 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'animate-modal-in',
          'w-full max-w-lg mx-0 sm:mx-4',
          'sm:rounded-3xl rounded-t-3xl',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'shadow-[0_8px_48px_rgba(0,0,0,0.7)]',
          'flex flex-col',
          'max-h-[92dvh] overflow-hidden',
        )}
      >
        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex flex-col gap-0">

          {/* ── Header band ── */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[var(--color-border-muted)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] tracking-widest uppercase">
              Hand #{result.handNumber}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Pot&nbsp;
              <span className="tabular-nums font-bold text-[var(--color-gold)]">
                {result.pot.toLocaleString()}
              </span>
            </p>
          </div>

          {/* ── Winner hero ── */}
          <div className={cn(
            'px-5 py-4 text-center',
            isCurrentPlayerWinner
              ? 'bg-[var(--color-gold)]/8'
              : 'bg-transparent',
          )}>
            <div className="text-3xl mb-1" aria-hidden="true">
              {isSplitPot ? '🤝' : '🏆'}
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight">
              {isSplitPot
                ? 'Split Pot!'
                : isCurrentPlayerWinner
                  ? 'You Win!'
                  : `${playerNames[result.winners[0]?.playerId ?? ''] ?? 'Unknown'} Wins!`}
            </h2>
            {/* Pot flow */}
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
              <span className="tabular-nums">
                💰 {result.pot.toLocaleString()} chips
              </span>
              <span aria-hidden="true">→</span>
              <span className="font-semibold text-[var(--color-gold)]">
                {isSplitPot
                  ? result.winners.map((w) => playerNames[w.playerId] ?? 'Unknown').join(' & ')
                  : (playerNames[result.winners[0]?.playerId ?? ''] ?? 'Unknown')}
              </span>
            </div>
          </div>

          {/* ── Winner cards ── */}
          <div className="px-4 pb-4 flex flex-col gap-3">
            {result.winners.map((winner) => (
              <WinnerSection
                key={`${winner.playerId}-${winner.amount}`}
                winner={winner}
                name={playerNames[winner.playerId] ?? 'Unknown'}
                isSelf={winner.playerId === currentPlayerId}
                finalChips={result.playerChips[winner.playerId] ?? 0}
              />
            ))}
          </div>

          {/* ── Community cards ── */}
          {result.communityCards.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide font-semibold">
                Board
              </p>
              <CardRow cards={result.communityCards} />
            </div>
          )}

          {/* ── All-player summary ── */}
          <PlayerSummary
            result={result}
            playerNames={playerNames}
            winnerIds={winnerIds}
            currentPlayerId={currentPlayerId}
          />

          {/* ── Busted / buy-back ── */}
          {isBrokeOut && allowBuyBack && (
            <div className="mx-5 mb-4 rounded-2xl p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-center">
              <p className="text-sm text-[var(--color-danger)] mb-3 font-semibold">
                You&apos;re out of chips!
              </p>
              <Button variant="gold" size="sm" isLoading={buyBackPending} onClick={() => void handleBuyBack()}>
                Buy Back In
              </Button>
            </div>
          )}

          {isBrokeOut && !allowBuyBack && (
            <p className="mx-5 mb-4 text-center text-sm text-[var(--color-danger)] font-semibold">
              You&apos;ve been eliminated.
            </p>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="px-5 py-4 border-t border-[var(--color-border-muted)] flex items-center justify-between gap-3 shrink-0">
          <p className="text-sm text-[var(--color-text-muted)]">
            Next hand in{' '}
            <span className="tabular-nums font-bold text-[var(--color-text-primary)]">{countdown}s</span>
          </p>
          {onNextHand && (
            <Button variant="primary" size="sm" onClick={onNextHand}>
              Next Hand →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Winner section (gold card with hand + chips) ──────────────────────────────

interface WinnerSectionProps {
  winner: WinnerResult;
  name: string;
  isSelf: boolean;
  finalChips: number;
}

function WinnerSection({ winner, name, isSelf, finalChips }: WinnerSectionProps): React.ReactElement {
  const rankLabel = winner.hand ? HAND_RANK_LABELS[winner.hand.rank] : null;
  const rankColorClass = winner.hand ? HAND_RANK_COLORS[winner.hand.rank] : null;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        isSelf
          ? 'border-[var(--color-gold)]/60 bg-[var(--color-gold)]/8 shadow-[0_0_24px_rgba(212,175,55,0.15)]'
          : 'border-[var(--color-border)] bg-[var(--color-canvas)]',
      )}
    >
      {/* Name + hand badge */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-bold text-[var(--color-text-primary)] text-sm">
          {isSelf ? 'You' : name}
        </span>
        {rankLabel && rankColorClass && (
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full border',
            rankColorClass,
          )}>
            ★ {rankLabel}
          </span>
        )}
        {!winner.hand && (
          <span className="text-xs text-[var(--color-text-muted)] px-2 py-0.5 rounded-full border border-[var(--color-border-muted)] bg-[var(--color-surface)]">
            Wins by fold
          </span>
        )}
      </div>

      {/* Best 5 cards */}
      {winner.hand?.cards && winner.hand.cards.length > 0 && (
        <div className="mb-3">
          <CardRow cards={winner.hand.cards.slice(0, 5)} highlight />
        </div>
      )}

      {/* Chip gain + new total */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="animate-chip-gain">
          <ChipGainBadge amount={winner.amount} />
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          New total:{' '}
          <span className="tabular-nums font-bold text-[var(--color-text-primary)]">
            {finalChips.toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}

// ── Player summary table ──────────────────────────────────────────────────────

interface PlayerSummaryProps {
  result: HandEndResult;
  playerNames: Record<string, string>;
  winnerIds: Set<string>;
  currentPlayerId: string | null | undefined;
}

function PlayerSummary({ result, playerNames, winnerIds, currentPlayerId }: PlayerSummaryProps): React.ReactElement {
  const allPlayerIds = Object.keys(result.playerChips);
  // Put non-winners first, winners last (winners already have the hero section)
  const nonWinners = allPlayerIds.filter((id) => !winnerIds.has(id));
  const winners = allPlayerIds.filter((id) => winnerIds.has(id));
  const sorted = [...nonWinners, ...winners];

  if (sorted.length <= 1) return <></>;

  return (
    <div className="px-5 pb-4">
      <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide font-semibold">
        All Players
      </p>
      <div className="rounded-2xl border border-[var(--color-border-muted)] overflow-hidden">
        {sorted.map((playerId, idx) => {
          const name = playerNames[playerId] ?? 'Unknown';
          const chips = result.playerChips[playerId] ?? 0;
          const hand = result.playerHands[playerId];
          const isWinner = winnerIds.has(playerId);
          const isSelf = playerId === currentPlayerId;
          const winnerEntry = result.winners.find((w) => w.playerId === playerId);
          const handLabel = hand?.bestHand ? HAND_RANK_LABELS[hand.bestHand.rank] : null;
          const folded = !hand && !isWinner;

          return (
            <div
              key={playerId}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5',
                idx < sorted.length - 1 && 'border-b border-[var(--color-border-muted)]',
                isWinner && 'bg-[var(--color-gold)]/5',
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                isWinner ? 'bg-[var(--color-gold)] text-[var(--color-text-on-light)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
              )}>
                {name.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <span className={cn(
                'text-sm font-semibold w-20 truncate shrink-0',
                isSelf ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-primary)]',
              )}>
                {isSelf ? 'You' : name}
              </span>

              {/* Hand name or folded */}
              <span className={cn(
                'text-xs flex-1 min-w-0',
                folded ? 'text-[var(--color-text-muted)] italic' : 'text-[var(--color-text-primary)]',
              )}>
                {folded ? 'Folded' : (handLabel ?? (isWinner && !winnerEntry?.hand ? 'Wins by fold' : '—'))}
              </span>

              {/* Best hand cards (mini) */}
              {hand?.bestHand?.cards && (
                <div className="hidden sm:flex gap-0.5 shrink-0">
                  {hand.bestHand.cards.slice(0, 5).map((card, i) => (
                    <PlayingCard key={i} card={card} size="sm" className="!w-6 !h-9 !text-[8px]" />
                  ))}
                </div>
              )}

              {/* Gain/chips */}
              <div className="flex flex-col items-end shrink-0 ml-auto">
                {isWinner && winnerEntry && (
                  <span className="text-xs font-bold text-[var(--color-success)] tabular-nums">
                    +{winnerEntry.amount.toLocaleString()}
                  </span>
                )}
                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                  {chips.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Card row ──────────────────────────────────────────────────────────────────

function CardRow({ cards, highlight }: { cards: readonly Card[]; highlight?: boolean }): React.ReactElement {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {cards.map((card, i) => (
        <PlayingCard
          key={i}
          card={card}
          size="md"
          className={cn(
            highlight && 'shadow-[0_0_10px_rgba(212,175,55,0.35)] ring-1 ring-[var(--color-gold)]/30',
          )}
        />
      ))}
    </div>
  );
}

// ── Chip gain badge ───────────────────────────────────────────────────────────

function ChipGainBadge({ amount }: { amount: number }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--color-success)]/15 border border-[var(--color-success)]/40 text-[var(--color-success)] text-sm font-bold tabular-nums">
      <span aria-hidden="true">+</span>
      {amount.toLocaleString()}
    </span>
  );
}

