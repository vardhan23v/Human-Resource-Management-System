import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Single-key shortcuts (ignored while typing): c check-in/out · n new request · t theme · g then d/e/a/l/p navigation · ? help. */
export function useShortcuts(handlers: { checkIn: () => void; theme: () => void; help: () => void }) {
  const nav = useNavigate();
  useEffect(() => {
    let pendingG = false; let timer: any;
    const typing = () => { const el = document.activeElement as HTMLElement | null; return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable); };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing()) return;
      if (pendingG) { pendingG = false; clearTimeout(timer);
        const map: Record<string, string> = { d: '/dashboard', e: '/directory', a: '/attendance', l: '/leave', p: '/payroll', t: '/team', r: '/reports', n: '/notifications', s: '/settings' };
        if (map[e.key]) { e.preventDefault(); nav(map[e.key]); } return; }
      switch (e.key) {
        case 'g': pendingG = true; timer = setTimeout(() => { pendingG = false; }, 1200); break;
        case 'c': e.preventDefault(); handlers.checkIn(); break;
        case 'n': e.preventDefault(); nav('/leave?new=1'); break;
        case 't': e.preventDefault(); handlers.theme(); break;
        case '?': e.preventDefault(); handlers.help(); break;
        case '/': e.preventDefault(); window.dispatchEvent(new Event('dayflow:palette')); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, nav]);
}
