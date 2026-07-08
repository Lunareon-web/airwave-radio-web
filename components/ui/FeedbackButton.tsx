'use client';

/**
 * FeedbackButton
 * Drop-in replacement for <button> with two layers of tactile feedback:
 *  1. Spring scale — button "presses" to tapScale and bounces back.
 *  2. Ripple      — a soft colour disc radiates from the tap / click point.
 *
 * Optional tapX / tapY give directional nudge for skip-forward / skip-back.
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface FeedbackButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  disabled?: boolean;
  /** Scale on tap.  Default 0.80 */
  tapScale?: number;
  /** Horizontal nudge on tap (px).  Use negative for "back", positive for "forward". */
  tapX?: number;
  /** Ripple fill colour.  Default 'rgba(255,255,255,0.20)' */
  rippleColor?: string;
}

export function FeedbackButton({
  children,
  onClick,
  className = '',
  style,
  title,
  disabled,
  tapScale = 0.80,
  tapX = 0,
  rippleColor = 'rgba(255,255,255,0.20)',
}: FeedbackButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  const addRipple = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Ripple diameter = 2.6× the largest dimension so it always fills the button
    const size = Math.max(rect.width, rect.height) * 2.6;
    const id = Date.now() + Math.random();
    setRipples(r => [...r, { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
    // Remove after animation completes
    setTimeout(() => setRipples(r => r.filter(x => x.id !== id)), 700);
  };

  return (
    <motion.button
      ref={btnRef}
      type="button"
      onClick={onClick}
      onPointerDown={addRipple}
      className={`feedback-btn ${className}`}
      style={{ ...style, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      title={title}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.07 }}
      whileTap={{ scale: tapScale, x: tapX }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      {ripples.map(r => (
        <span
          key={r.id}
          className="btn-ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size, background: rippleColor }}
        />
      ))}
      {children}
    </motion.button>
  );
}
