import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = Number(value) || 0;
    if (reduced) { setN(target); from.current = target; return; }
    const start = performance.now(), s = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(s + (target - s) * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const rounded = Math.round(n);
  return <>{format ? format(rounded) : rounded.toLocaleString()}</>;
}
