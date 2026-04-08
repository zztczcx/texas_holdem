import { cn } from '@/lib/utils/cn';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Set true for game pages that should fill the viewport without max-width */
  fullWidth?: boolean;
}

export function PageContainer({ children, className, fullWidth = false }: PageContainerProps): React.ReactElement {
  return (
    <main
      className={cn(
        'min-h-screen w-full',
        !fullWidth && 'mx-auto max-w-5xl px-4 py-8 md:px-8',
        className,
      )}
    >
      {children}
    </main>
  );
}
