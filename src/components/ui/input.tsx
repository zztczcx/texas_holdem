import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: InputProps): React.ReactElement {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-2xl px-4 py-2.5 text-sm',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
          'focus:outline-none focus:border-[var(--color-focus)]',
          'focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1',
          'focus:ring-offset-[var(--color-canvas)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]',
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
