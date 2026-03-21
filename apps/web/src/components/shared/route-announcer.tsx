'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setAnnouncement(document.title || 'Page changed');
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      role="status"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
