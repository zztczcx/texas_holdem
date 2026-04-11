'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ExpiredTableBanner(): React.ReactElement | null {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setVisible(true);
      // Clean the query param from the URL without a page reload
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="w-full max-w-xl rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 flex items-center justify-between gap-3 mb-2"
    >
      <p className="text-sm text-[var(--color-danger)]">
        That table has expired or no longer exists.
      </p>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="text-[var(--color-danger)]/60 hover:text-[var(--color-danger)] transition-colors text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
