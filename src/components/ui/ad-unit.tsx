'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdUnitProps {
  className?: string;
}

export function AdUnit({ className }: AdUnitProps): React.ReactElement | null {
  const insRef = useRef<HTMLModElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      setHidden(true);
      return;
    }

    const ins = insRef.current;
    if (!ins) return;

    // AdSense sets data-ad-status="filled" or "unfilled" after the auction
    const observer = new MutationObserver(() => {
      const status = ins.getAttribute('data-ad-status');
      if (status === 'unfilled') setHidden(true);
    });

    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, []);

  if (hidden) return null;

  return (
    <div className={className}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2430817783068325"
        data-ad-slot="9440787658"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
