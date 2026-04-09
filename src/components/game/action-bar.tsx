'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { RaiseSlider } from './raise-slider';
import type { ActionType, GameState, Player, GameSettings } from '@/types/game';
import { getValidActions, getCallAmount } from '@/lib/game/betting';

export interface ActionBarProps {
  player: Player;
  gameState: Omit<GameState, 'deck'> & { deck: null };
  settings: GameSettings;
  onAction: (type: ActionType, amount?: number) => Promise<void>;
  className?: string;
}

/**
 * The bottom action bar shown to the active player.
 * Renders Fold / Check / Call / Raise buttons based on valid actions.
 */
export function ActionBar({ player, gameState, settings, onAction, className }: ActionBarProps): React.ReactElement | null {
  const [isPending, startTransition] = useTransition();
  const [showRaise, setShowRaise] = useState(false);

  // Reconstruct a "fake" game state with deck for the pure function
  const stateWithDeck = { ...gameState, deck: [] as const } as GameState;
  const validActions = getValidActions(stateWithDeck, player, settings);

  if (validActions.length === 0) return null;

  const callAmount = getCallAmount(stateWithDeck, player);
  const raiseAction = validActions.find((a) => a.type === 'raise' || a.type === 'allIn');
  const canCheck = validActions.some((a) => a.type === 'check');
  const canCall = validActions.some((a) => a.type === 'call');
  const canRaise = validActions.some((a) => a.type === 'raise' || a.type === 'allIn');

  function dispatch(type: ActionType, amount?: number): void {
    startTransition(async () => {
      await onAction(type, amount);
      setShowRaise(false);
    });
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-2xl',
        'bg-[var(--color-surface)] border border-[var(--color-border-muted)]',
        className,
      )}
      aria-label="Your turn — choose an action"
    >
      {showRaise && canRaise && raiseAction ? (
        <div className="flex flex-col gap-2">
          <RaiseSlider
            minRaise={raiseAction.minAmount ?? player.chips}
            maxRaise={raiseAction.maxAmount ?? player.chips}
            callAmount={callAmount}
            onAction={(type, amount) => dispatch(type, amount)}
            isLoading={isPending}
          />
          <Button variant="secondary" size="sm" onClick={() => setShowRaise(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center w-full">
          {/* Fold */}
          <Button
            variant="danger"
            size="md"
            isLoading={isPending}
            onClick={() => dispatch('fold')}
          >
            Fold
          </Button>

          {/* Check */}
          {canCheck && (
            <Button
              variant="secondary"
              size="md"
              isLoading={isPending}
              onClick={() => dispatch('check')}
            >
              Check
            </Button>
          )}

          {/* Call */}
          {canCall && (
            <Button
              variant="primary"
              size="md"
              isLoading={isPending}
              onClick={() => dispatch('call')}
            >
              Call {callAmount.toLocaleString()}
            </Button>
          )}

          {/* Raise */}
          {canRaise && (
            <Button
              variant="gold"
              size="md"
              onClick={() => setShowRaise(true)}
            >
              Raise
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
