import { useEffect, useRef, useState } from 'react';

/** Smoothly animate a number (count-up / count-down) */
export function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * e;
      setVal(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  useEffect(() => {
    fromRef.current = val;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val]);

  return val;
}

export function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const n = useCountUp(value);
  return <>{n.toFixed(decimals)}{suffix}</>;
}
