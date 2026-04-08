'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { ActionType } from '@/types/game';

export interface RaiseSliderProps {
  minRaise: number;
  maxRaise: number;
  callAmount: number;
  onAction: (type: ActionType, amount?: number) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Raise amount slider with quick-select shortcuts.
 */
export function RaiseSlider({
  minRaise,
  maxRaise,
  callAmount,
  onAction,
  isLoading,
  className,
}: RaiseSliderProps): React.ReactElement {
  const [amount, setAmount] = useState(minRaise);

  const shortcuts = [
    { label: 'Min', value: minRaise },
    { label: '½ Pot', value: Math.max(minRaise, Math.round(maxRaise * 0.25)) },
    { label: 'Pot', value: Math.max(minRaise, Math.round(maxRaise * 0.5)) },
    { label: 'All-in', value: maxRaise },
  ];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Slider
        label="Raise Amount"
        value={amount}
        min={minRaise}
        max={maxRaise}
        step={1}
        displayValue={amount.toLocaleString()}
        onValueChange={setAmount}
      />

      {/* Quick shortcuts */}
      <div className="flex gap-1.5 flex-wrap">
        {shortcuts.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setAmount(value)}
            className={cn(
              'px-2 py-1 text-xs font-semibold rounded-lg transition-colors',
              'bg-[var(--color-border-muted)] text-[var(--color-text-muted)]',
              'hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]',
              amount === value && 'bg-[var(--color-felt)] text-[var(--color-text-primary)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Raise action button */}
      <Button
        variant="primary"
        size="sm"
        isLoading={isLoading}
        onClick={() => onAction(amount >= maxRaise ? 'allIn' : 'raise', amount)}
        disabled={amount < minRaise || amount > maxRaise || callAmount < 0}
      >
        {amount >= maxRaise ? 'All-in' : `Raise to ${amount.toLocaleString()}`}
      </Button>
    </div>
  );
}
