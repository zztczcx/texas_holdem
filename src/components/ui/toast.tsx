'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface Toast {
  id: string;
  message: string;
  variant?: 'default' | 'success' | 'danger' | 'gold';
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const variantClasses: Record<NonNullable<Toast['variant']>, string> = {
  default: 'bg-[var(--color-surface)] border-[var(--color-border)]',
  success: 'bg-[var(--color-success)]/20 border-[var(--color-success)]/30',
  danger: 'bg-[var(--color-danger)]/20 border-[var(--color-danger)]/30',
  gold: 'bg-[var(--color-gold)]/20 border-[var(--color-gold)]/30',
};

const variantTextClasses: Record<NonNullable<Toast['variant']>, string> = {
  default: 'text-[var(--color-text-primary)]',
  success: 'text-[var(--color-success)]',
  danger: 'text-[var(--color-danger)]',
  gold: 'text-[var(--color-gold)]',
};

function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl px-4 py-3',
        'border shadow-[0_4px_16px_rgba(0,0,0,0.4)] min-w-[240px] max-w-sm',
        'animate-in slide-in-from-bottom-2 fade-in duration-200',
        variantClasses[toast.variant ?? 'default'],
      )}
    >
      <p className={cn('text-sm font-medium', variantTextClasses[toast.variant ?? 'default'])}>
        {toast.message}
      </p>
      <button
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/**
 * Fixed-position toast notification container.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps): React.ReactElement {
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ── Hook for managing toasts ─────────────────────────────────────────────────

let _addToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function useToast(): {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
} {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(toast: Omit<Toast, 'id'>): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }

  function dismissToast(id: string): void {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // Register global toast function for imperative use
  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  });

  return { toasts, addToast, dismissToast };
}

/** Imperatively add a toast (works outside React components). */
export function toast(message: string, variant?: Toast['variant']): void {
  _addToast?.({ message, variant });
}
