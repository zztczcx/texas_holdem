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

export function AdUnit({ className }: AdUnitProps): React.ReactElement {
  const insRef = useRef<HTMLModElement>(null);
  // Start hidden — only reveal once AdSense confirms the slot is filled
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ad blocker or script not loaded — observer will never fire; stays hidden
    }

    // AdSense sets data-ad-status="filled" or "unfilled" after the auction
    const observer = new MutationObserver(() => {
      const status = ins.getAttribute('data-ad-status');
      if (status === 'filled') setFilled(true);
    });

    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={filled ? className : undefined} style={filled ? undefined : { display: 'none' }}>
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
