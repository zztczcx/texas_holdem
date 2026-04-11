'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdUnitProps {
  className?: string;
}

export function AdUnit({ className }: AdUnitProps): React.ReactElement {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ad blocker or script not loaded — fail silently
    }
  }, []);

  return (
    <div className={className}>
      <ins
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
