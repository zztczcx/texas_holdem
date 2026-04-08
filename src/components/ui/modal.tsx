'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'fixed inset-0 m-auto w-full max-w-md rounded-3xl p-6',
        'bg-[var(--color-surface)] border border-[var(--color-border)]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.6)]',
        'text-[var(--color-text-primary)]',
        'backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        'open:flex open:flex-col open:gap-4',
        className,
      )}
    >
      {title && (
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h2>
      )}
      {children}
    </dialog>
  );
}
