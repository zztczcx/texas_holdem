import { cn } from '@/lib/utils/cn';

export type BadgeVariant = 'default' | 'success' | 'danger' | 'gold' | 'muted';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-border-muted)] text-[var(--color-text-muted)]',
  success: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
  danger: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]',
  gold: 'bg-[var(--color-gold)]/20 text-[var(--color-gold)]',
  muted: 'bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border-muted)]',
};

export function Badge({ variant = 'default', children, className }: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xl px-2.5 py-0.5 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
