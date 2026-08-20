"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function HideNextDevOverlay() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if ((pathname || '').startsWith('/admin')) return;

    const style = document.createElement('style');
    style.setAttribute('data-hide-nextjs-portal', '1');
    style.textContent = 'nextjs-portal{display:none !important;}';
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [pathname]);

  return null;
}
