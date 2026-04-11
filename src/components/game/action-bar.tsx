'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { RaiseSlider } from '@/components/game/raise-slider';
import { useI18n } from '@/components/layout/i18n-provider';
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
 * Renders Fold / Check or Call / Raise or Bet / All-in controls with preset chips.
 */
export function ActionBar({ player, gameState, settings, onAction, className }: ActionBarProps): React.ReactElement | null {
  const [isPending, startTransition] = useTransition();
  const [isRaisePanelOpen, setIsRaisePanelOpen] = useState(false);
  const { t } = useI18n();

  const stateWithDeck = { ...gameState, deck: [] as const } as GameState;
  const validActions = getValidActions(stateWithDeck, player, settings);

  const callAmount = getCallAmount(stateWithDeck, player);
  const raiseAction = validActions.find((action) => action.type === 'raise');
  const canCheck = validActions.some((action) => action.type === 'check');
  const canCall = validActions.some((action) => action.type === 'call');
  const canRaise = Boolean(raiseAction);
  const canAllIn = validActions.some((action) => action.type === 'allIn');
  const minRaise = raiseAction?.minAmount ?? 0;
  const maxRaise = raiseAction?.maxAmount ?? player.chips;
  const raiseVerb = gameState.currentBet === 0 ? t.actionBar.bet : t.actionBar.raise;

  if (validActions.length === 0) return null;

  function dispatch(type: ActionType, amount?: number): void {
    startTransition(async () => {
      await onAction(type, amount);
      setIsRaisePanelOpen(false);
    });
  }

  function handleRaiseButtonClick(): void {
    if (!canRaise) return;
    setIsRaisePanelOpen((open) => !open);
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[28px] border p-4',
        'border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_4px_16px_rgba(0,0,0,0.4)]',
        className,
      )}
      aria-label="Your turn - choose an action"
    >
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          isRaisePanelOpen && canRaise ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="rounded-[20px] border border-[var(--color-border-muted)] bg-[var(--color-canvas)]/32 px-3 py-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {t.actionBar.selectBetSize}
            </p>
            <RaiseSlider
              minRaise={minRaise}
              maxRaise={maxRaise}
              callAmount={callAmount}
              isLoading={isPending}
              onAction={(type, amount) => dispatch(type, amount)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          variant="danger"
          size="md"
          isLoading={isPending}
          onClick={() => dispatch('fold')}
          className="w-full justify-center"
        >
          {t.actionBar.fold}
        </Button>

        {canCheck ? (
          <Button
            variant="secondary"
            size="md"
            isLoading={isPending}
            onClick={() => dispatch('check')}
            className="w-full justify-center"
          >
            {t.actionBar.check}
          </Button>
        ) : canCall ? (
          <Button
            variant="primary"
            size="md"
            isLoading={isPending}
            onClick={() => dispatch('call', callAmount)}
            className="w-full justify-center"
          >
            {t.actionBar.call} {formatCurrency(callAmount)}
          </Button>
        ) : (
          <div aria-hidden="true" className="hidden sm:block" />
        )}

        {canRaise ? (
          <Button
            variant="primary"
            size="md"
            isLoading={isPending}
            onClick={handleRaiseButtonClick}
            className="w-full justify-center"
          >
            {raiseVerb}
          </Button>
        ) : (
          <div aria-hidden="true" className="hidden sm:block" />
        )}

        {canAllIn ? (
          <Button
            variant="gold"
            size="md"
            isLoading={isPending}
            onClick={() => dispatch('allIn')}
            className="w-full justify-center"
          >
            {t.actionBar.allIn} {formatCurrency(player.chips)}
          </Button>
        ) : (
          <div aria-hidden="true" className="hidden sm:block" />
        )}
      </div>

      {isRaisePanelOpen && canRaise && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsRaisePanelOpen(false)}
            className="border-[var(--color-border)] bg-[var(--color-border-muted)]/70"
          >
            {t.lobby.cancel}
          </Button>
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
