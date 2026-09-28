import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';

export function NumberTicker({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const valueMotion = useMotionValue(0);
  const spring = useSpring(valueMotion, { damping: 60, stiffness: 100 });
  const visible = useInView(ref, { once: true });
  useEffect(() => { if (visible) valueMotion.set(value); }, [visible, valueMotion, value]);
  useEffect(() => spring.on('change', latest => { if (ref.current) ref.current.textContent = Math.round(latest).toLocaleString(); }), [spring]);
  return <span ref={ref} className={`tabular-nums ${className}`}>0</span>;
}
