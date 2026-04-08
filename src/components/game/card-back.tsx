import { cn } from '@/lib/utils/cn';

export interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-9 h-14',
  md: 'w-14 h-20',
  lg: 'w-20 h-28',
};

/**
 * A face-down playing card rendered with a decorative hatched pattern.
 */
export function CardBack({ size = 'md', className }: CardBackProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-lg border border-[#2a4d7a] bg-[var(--color-card-back)]',
        'shadow-[0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden select-none',
        sizeClasses[size],
        className,
      )}
    >
      {/* Inner decorative border */}
      <div className="w-full h-full border-2 border-[#2a4d7a]/50 rounded-md m-0.5 flex items-center justify-center">
        <span className="text-[#2a4d7a]/60 text-xs font-bold rotate-45 opacity-60">
          ♠♥♦♣
        </span>
      </div>
    </div>
  );
}
