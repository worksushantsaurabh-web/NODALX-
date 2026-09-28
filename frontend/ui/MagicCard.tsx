import { useMotionTemplate, useMotionValue, useSpring, motion } from 'motion/react';
import type { ReactNode, PointerEvent } from 'react';

export function MagicCard({ children, className = '', gradientSize = 180 }: { children: ReactNode; className?: string; gradientSize?: number }) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);
  const smoothX = useSpring(mouseX, { stiffness: 250, damping: 30, mass: 0.6 });
  const smoothY = useSpring(mouseY, { stiffness: 250, damping: 30, mass: 0.6 });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  };
  return (
    <motion.div className={`magic-card group relative isolate overflow-hidden rounded-[inherit] border border-transparent ${className}`} onPointerMove={move} onPointerLeave={() => { mouseX.set(-gradientSize); mouseY.set(-gradientSize); }} style={{ background: useMotionTemplate`linear-gradient(var(--color-surface) 0 0) padding-box, radial-gradient(${gradientSize}px circle at ${smoothX}px ${smoothY}px, #9E7AFF, #64B5F6, var(--color-border) 100%) border-box` }}>
      <div className="pointer-events-none absolute inset-px z-10 rounded-[inherit] bg-surface/70 backdrop-blur-xl" />
      <div className="relative z-20">{children}</div>
    </motion.div>
  );
}
