'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { HandEndResult, WinnerResult } from '@/types/game';
import { Button } from '@/components/ui/button';
import { PlayingCard } from '@/components/game/playing-card';
import { HandResult } from '@/components/game/hand-result';
import { ChipStack } from '@/components/game/chip-stack';

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

/**
 * Full-screen showdown overlay displaying winner, cards, and hand types.
 * Includes auto-advance countdown and optional buy-back button.
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

  const winnerIds = result.winners.map((w) => w.playerId);
  const isWinner = currentPlayerId ? winnerIds.includes(currentPlayerId) : false;
  const isBrokeOut = currentPlayerId && currentPlayerChips === 0;

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
        'fixed inset-0 z-40 flex items-center justify-center',
        'bg-black/70 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'w-full max-w-lg mx-4 rounded-3xl p-6',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.6)]',
          'flex flex-col gap-5',
        )}
      >
        {/* Header */}
        <div className="text-center">
          {isWinner ? (
            <p className="text-3xl font-bold text-[var(--color-gold)]">You Win! ★</p>
          ) : (
            <p className="text-xl font-bold text-[var(--color-text-primary)]">Hand Complete</p>
          )}
        </div>

        {/* Winners */}
        <div className="flex flex-col gap-3">
          {result.winners.map((winner) => (
            <WinnerCard
              key={`${winner.playerId}-${winner.amount}`}
              winner={winner}
              name={playerNames[winner.playerId] ?? 'Unknown'}
            />
          ))}
        </div>

        {/* Eliminated / buy-back */}
        {isBrokeOut && allowBuyBack && (
          <div className="rounded-2xl p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-center">
            <p className="text-sm text-[var(--color-danger)] mb-3 font-semibold">
              You&apos;re out of chips!
            </p>
            <Button variant="gold" size="sm" isLoading={buyBackPending} onClick={() => void handleBuyBack()}>
              Buy Back In
            </Button>
          </div>
        )}

        {isBrokeOut && !allowBuyBack && (
          <p className="text-center text-sm text-[var(--color-danger)] font-semibold">
            You&apos;ve been eliminated.
          </p>
        )}

        {/* Auto-advance countdown */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Next hand in <span className="tabular-nums font-bold text-[var(--color-text-primary)]">{countdown}s</span>
          </p>
          {onNextHand && (
            <Button variant="primary" size="sm" onClick={onNextHand}>
              Next Hand
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface WinnerCardProps {
  winner: WinnerResult;
  name: string;
}

function WinnerCard({ winner, name }: WinnerCardProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border-muted)]">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-sm font-bold text-[var(--color-text-on-light)] shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{name}</p>

        {winner.hand && (
          <HandResult
            rank={winner.hand.rank}
            description={winner.hand.rankName}
            isWinner
            className="mt-1"
          />
        )}

        {winner.hand?.cards && (
          <div className="flex gap-1 mt-2">
            {winner.hand.cards.slice(0, 5).map((card, i) => (
              <PlayingCard key={i} card={card} size="sm" />
            ))}
          </div>
        )}
      </div>

      <ChipStack amount={winner.amount} inline className="shrink-0" />
    </div>
  );
}
