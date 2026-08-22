import { useEffect } from 'react';

/** Global click ripple for .btn elements — one listener, no per-button wiring. */
export function useRipple() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element)?.closest?.('.btn') as HTMLElement | null;
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;`;
      btn.appendChild(span);
      setTimeout(() => span.remove(), 600);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
