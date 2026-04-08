import { cn } from '@/lib/utils/cn';
import type { SidePot } from '@/types/game';
import { ChipStack } from './chip-stack';

export interface PotDisplayProps {
  pot: number;
  sidePots?: readonly SidePot[];
  className?: string;
}

/**
 * Shows the main pot + any side pots.
 */
export function PotDisplay({ pot, sidePots, className }: PotDisplayProps): React.ReactElement {
  const hasSidePots = sidePots && sidePots.length > 0;

  return (
    <div
      className={cn('flex flex-col items-center gap-1', className)}
      aria-label={`Pot: ${pot} chips`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Pot
        </span>
        <ChipStack amount={pot} inline />
      </div>

      {hasSidePots && (
        <div className="flex flex-wrap gap-2 justify-center">
          {sidePots.map((sp, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Side {i + 1}</span>
              <ChipStack amount={sp.amount} inline />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
