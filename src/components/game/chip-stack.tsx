import { cn } from '@/lib/utils/cn';

export interface ChipStackProps {
  amount: number;
  className?: string;
  /** Show a compact inline badge instead of a stacked visual */
  inline?: boolean;
}

/** Denomination color classes */
const DENOM_COLORS = [
  { threshold: 100, bg: 'bg-[var(--color-gold)]', label: '100' },
  { threshold: 25, bg: 'bg-[#7b2d8b]', label: '25' },
  { threshold: 5, bg: 'bg-[#3a7bd5]', label: '5' },
  { threshold: 1, bg: 'bg-[#e8e8e8]', label: '1' },
] as const;

function getDenomColor(amount: number): string {
  for (const denom of DENOM_COLORS) {
    if (amount >= denom.threshold) return denom.bg;
  }
  return DENOM_COLORS[DENOM_COLORS.length - 1].bg;
}

/**
 * Visual chip stack showing an amount.
 * If `inline` is set, renders as a compact badge (for table overlays).
 */
export function ChipStack({ amount, className, inline = false }: ChipStackProps): React.ReactElement {
  if (inline) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 tabular-nums',
          'rounded-xl px-2 py-0.5 text-xs font-semibold',
          'bg-[var(--color-canvas)]/80 text-[var(--color-gold)] border border-[var(--color-gold)]/30',
          className,
        )}
        aria-label={`${amount} chips`}
      >
        <span
          aria-hidden="true"
          className={cn('w-2.5 h-2.5 rounded-full shrink-0', getDenomColor(amount))}
        />
        {amount.toLocaleString()}
      </span>
    );
  }

  // Determine how many chip circles to show (max 5)
  const stackCount = Math.min(Math.ceil(amount / 100), 5);

  return (
    <div
      className={cn('flex flex-col items-center gap-0.5', className)}
      aria-label={`${amount} chips`}
    >
      {/* Stack of chips */}
      <div className="flex flex-col-reverse gap-0.5">
        {Array.from({ length: stackCount }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(
              'w-8 h-3 rounded-full border border-black/20',
              getDenomColor(amount),
            )}
          />
        ))}
      </div>
      {/* Amount label */}
      <span className="tabular-nums text-xs font-semibold text-[var(--color-gold)]">
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
