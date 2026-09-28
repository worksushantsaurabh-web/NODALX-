import { motion } from 'motion/react';

export function BorderBeam({ className = '', duration = 7 }: { className?: string; duration?: number }) {
  return <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`} aria-hidden="true"><motion.div className="absolute -inset-1/2 h-[200%] w-10" style={{ background: 'linear-gradient(180deg, transparent, #9E7AFF, #64B5F6, transparent)' }} animate={{ left: ['-10%', '110%'] }} transition={{ duration, repeat: Infinity, ease: 'linear' }} /></div>;
}
