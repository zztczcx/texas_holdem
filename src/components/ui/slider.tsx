'use client';

import { cn } from '@/lib/utils/cn';

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onValueChange?: (value: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  onValueChange,
  className,
  id,
  ...props
}: SliderProps): React.ReactElement {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      {(label || displayValue !== undefined) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={inputId}
              className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide"
            >
              {label}
            </label>
          )}
          {displayValue !== undefined && (
            <span className="tabular-nums text-sm font-semibold text-[var(--color-gold)]">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        id={inputId}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange?.(Number(e.target.value))}
        style={
          {
            '--slider-percent': `${percent}%`,
          } as React.CSSProperties
        }
        className={cn(
          'w-full h-2 rounded-full appearance-none cursor-pointer',
          'bg-[var(--color-border-muted)]',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-gold)]',
          '[&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5',
          '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--color-gold)]',
          '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
          className,
        )}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        {...props}
      />
    </div>
  );
}
