import { useEffect, useRef } from 'react';

/**
 * Dot + lagging ring cursor. Transform-only, rAF-driven, pointer-events:none.
 * Only activates on fine pointers; respects prefers-reduced-motion (no lag, no scale).
 */
export default function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine) return;
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('has-cursor');
    body.classList.add('cursor-hidden');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let raf = 0;
    const ease = reduced ? 1 : 0.16;

    const frame = () => {
      rx += (mx - rx) * ease; ry += (my - ry) * ease;
      if (dot.current) dot.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const interactive = 'a, button, [role="button"], .btn, label, select, [data-cursor="hover"], .hover-lift, .tab';
    const textual = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, [contenteditable="true"]';

    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      body.classList.remove('cursor-hidden');
      const t = e.target as Element | null;
      body.classList.toggle('cursor-hover', !!t?.closest(interactive));
      body.classList.toggle('cursor-text', !!t?.closest(textual));
    };
    const onDown = () => body.classList.add('cursor-down');
    const onUp = () => body.classList.remove('cursor-down');
    const onLeave = () => body.classList.add('cursor-hidden');
    const onEnter = () => body.classList.remove('cursor-hidden');

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      html.classList.remove('has-cursor');
      body.classList.remove('cursor-hidden', 'cursor-hover', 'cursor-down', 'cursor-text');
    };
  }, []);

  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden="true" />
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
