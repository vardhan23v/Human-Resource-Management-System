import { useEffect } from 'react';

/** Adds .revealed to any .reveal element when it scrolls into view — including elements mounted later (after data loads). */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(e => e.classList.add('revealed'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('revealed'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    const scan = () => document.querySelectorAll<HTMLElement>('.reveal:not(.revealed)').forEach(e => io.observe(e));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
