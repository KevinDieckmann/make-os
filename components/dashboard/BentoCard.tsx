'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'violet' | 'emerald' | 'pink' | 'amber' | 'blue' | 'none';
  interactive?: boolean;
  style?: React.CSSProperties;
}

const GLOW_SHADOWS = {
  violet:  '0 0 0 1px rgba(139,92,246,0.15), 0 8px 40px rgba(139,92,246,0.08)',
  emerald: '0 0 0 1px rgba(16,185,129,0.15),  0 8px 40px rgba(16,185,129,0.07)',
  pink:    '0 0 0 1px rgba(236,72,153,0.15),   0 8px 40px rgba(236,72,153,0.07)',
  amber:   '0 0 0 1px rgba(245,158,11,0.15),   0 8px 40px rgba(245,158,11,0.07)',
  blue:    '0 0 0 1px rgba(96,165,250,0.15),   0 8px 40px rgba(96,165,250,0.07)',
  none:    'none',
};

export function BentoCard({ children, className, glowColor = 'none', interactive = true, style }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      whileHover={interactive ? { y: -2, transition: { type: 'spring', stiffness: 500, damping: 35 } } : undefined}
      className={cn('bento-card relative', className)}
      style={{
        boxShadow: interactive ? `0 1px 3px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3)` : undefined,
        ...style,
      }}
      whileFocus={interactive ? { boxShadow: GLOW_SHADOWS[glowColor] } : undefined}
    >
      {/* Subtle top highlight */}
      <div className="absolute top-0 inset-x-0 h-px pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)' }} />
      <div className="relative z-10 h-full">
        {children}
      </div>
    </motion.div>
  );
}
