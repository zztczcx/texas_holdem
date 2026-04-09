'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TurnTimerProps {
  /** Total seconds for the turn */
  totalSeconds: number;
  /** Whether the timer is active */
  isActive: boolean;
  /** Called when the timer reaches zero */
  onExpire?: () => void;
  className?: string;
}

/**
 * Circular countdown timer for the active player's turn.
 * Reset is performed inside a setTimeout callback (not synchronously in effect body)
 * to comply with react-hooks/set-state-in-effect.
 */
export function TurnTimer({ totalSeconds, isActive, onExpire, className }: TurnTimerProps): React.ReactElement {
  const [remaining, setRemaining] = useState(totalSeconds);

  // Keep a stable ref to onExpire so the expiry effect never needs it as a dep.
  // This prevents infinite loops when the parent re-renders (creating a new function ref)
  // while the timer is already at zero.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // Countdown + reset — setState only inside timer callbacks, never synchronously in body
  useEffect(() => {
    if (!isActive) return;

    // Reset to totalSeconds via a 0ms callback (not a synchronous body call)
    const resetId = setTimeout(() => setRemaining(totalSeconds), 0);
    // Tick every second
    const tickId = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);

    return () => {
      clearTimeout(resetId);
      clearInterval(tickId);
    };
  }, [isActive, totalSeconds]);

  // Fire expiry callback when remaining hits zero.
  // onExpireRef is NOT in deps — the ref update effect above keeps it current without
  // causing this effect to re-run on every parent render.
  useEffect(() => {
    if (isActive && remaining === 0) {
      onExpireRef.current?.();
    }
  }, [isActive, remaining]);

  const percent = Math.max(0, remaining / totalSeconds);
  const isWarning = remaining <= 10;
  const isDanger = remaining <= 5;

  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent);

  if (!isActive) return <></>;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="timer"
      aria-label={`${remaining} seconds remaining`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="opacity-20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-[stroke-dashoffset] duration-1000 linear',
            isDanger
              ? 'text-[var(--color-danger)]'
              : isWarning
              ? 'text-[var(--color-warning)]'
              : 'text-[var(--color-gold)]',
          )}
        />
      </svg>
      <span
        className={cn(
          'absolute tabular-nums text-xs font-bold',
          isDanger
            ? 'text-[var(--color-danger)]'
            : isWarning
            ? 'text-[var(--color-warning)]'
            : 'text-[var(--color-text-primary)]',
        )}
      >
        {remaining}
      </span>
    </div>
  );
}
