import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

/**
 * Adapted from Magic UI's Blur Fade registry component for this site's
 * restrained motion language. Reveals once, and renders immediately when
 * the visitor prefers reduced motion.
 */
export function BlurFade({
  children,
  className,
  delay = 0,
  inView = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: '-24px' });
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(2px)' }}
      animate={reducedMotion || !inView || visible
        ? { opacity: 1, y: 0, filter: 'blur(0px)' }
        : { opacity: 0, y: 8, filter: 'blur(2px)' }}
      transition={{ duration: reducedMotion ? 0 : 0.46, delay: reducedMotion ? 0 : delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
