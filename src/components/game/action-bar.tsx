'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
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
  const [selectedRaiseAmount, setSelectedRaiseAmount] = useState<number | null>(null);

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
  const raiseVerb = gameState.currentBet === 0 ? 'Bet' : 'Raise';
  const presetOptions = canRaise ? buildPresetOptions(gameState.pot, minRaise, maxRaise) : [];
  const effectiveSelectedRaiseAmount = selectedRaiseAmount === null
    ? null
    : clamp(selectedRaiseAmount, minRaise, maxRaise);

  if (validActions.length === 0) return null;

  function dispatch(type: ActionType, amount?: number): void {
    startTransition(async () => {
      await onAction(type, amount);
      setIsRaisePanelOpen(false);
      setSelectedRaiseAmount(null);
    });
  }

  function handleRaiseButtonClick(): void {
    if (!canRaise) {
      return;
    }

    if (!isRaisePanelOpen) {
      setIsRaisePanelOpen(true);
      return;
    }

    if (effectiveSelectedRaiseAmount === null) {
      return;
    }

    dispatch(
      effectiveSelectedRaiseAmount >= maxRaise ? 'allIn' : 'raise',
      effectiveSelectedRaiseAmount,
    );
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Preset chips
              </p>
              {effectiveSelectedRaiseAmount !== null && (
                <span className="rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/14 px-2.5 py-1 text-xs font-semibold text-[var(--color-gold)]">
                  {raiseVerb} {formatCurrency(effectiveSelectedRaiseAmount)}
                </span>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {presetOptions.map((option) => (
                <button
                  key={`${option.label}-${option.amount}`}
                  type="button"
                  aria-pressed={effectiveSelectedRaiseAmount === option.amount}
                  onClick={() => setSelectedRaiseAmount(option.amount)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.08em] transition-colors',
                    'border-[var(--color-border)] bg-[var(--color-border-muted)]/70 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/70 hover:text-[var(--color-text-primary)]',
                    effectiveSelectedRaiseAmount === option.amount && 'border-[var(--color-gold)]/30 bg-[var(--color-gold)]/14 text-[var(--color-gold)]',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
          Fold
        </Button>

        {canCheck ? (
          <Button
            variant="secondary"
            size="md"
            isLoading={isPending}
            onClick={() => dispatch('check')}
            className="w-full justify-center"
          >
            Check
          </Button>
        ) : canCall ? (
          <Button
            variant="primary"
            size="md"
            isLoading={isPending}
            onClick={() => dispatch('call')}
            className="w-full justify-center"
          >
            Call {formatCurrency(callAmount)}
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
            disabled={isRaisePanelOpen && effectiveSelectedRaiseAmount === null}
            className="w-full justify-center"
          >
            {isRaisePanelOpen && effectiveSelectedRaiseAmount !== null
              ? `${raiseVerb} ${formatCurrency(effectiveSelectedRaiseAmount)}`
              : raiseVerb}
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
            All-in {formatCurrency(player.chips)}
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
            onClick={() => {
              setIsRaisePanelOpen(false);
              setSelectedRaiseAmount(null);
            }}
            className="border-[var(--color-border)] bg-[var(--color-border-muted)]/70"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

interface PresetOption {
  label: string;
  amount: number;
}

function buildPresetOptions(pot: number, minRaise: number, maxRaise: number): readonly PresetOption[] {
  const rawOptions: readonly PresetOption[] = [
    { label: '$500', amount: 500 },
    { label: '$1K', amount: 1_000 },
    { label: '$2K', amount: 2_000 },
    { label: '$5K', amount: 5_000 },
    { label: '1/2 Pot', amount: Math.max(1, Math.round(pot / 2)) },
    { label: 'Full Pot', amount: Math.max(1, Math.round(pot)) },
  ];

  const seenAmounts = new Set<number>();

  return rawOptions.flatMap((option) => {
    const amount = clamp(option.amount, minRaise, maxRaise);
    if (amount < minRaise || amount > maxRaise || seenAmounts.has(amount)) {
      return [];
    }

    seenAmounts.add(amount);
    return [{ ...option, amount }];
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
