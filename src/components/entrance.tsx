'use client';

import { motion, useReducedMotion } from 'motion/react';

export function Entrance({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return <motion.div className="ui-entrance" initial={false}
    animate={reduced ? undefined : { opacity: [0.65, 1], scale: [0.99, 1] }}
    transition={{ duration: 0.18 }}>{children}</motion.div>;
}
