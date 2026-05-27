'use client';

import { ReactNode } from 'react';

type ChipVariant = 'default' | 'accent' | 'dark' | 'ghost';

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Chip({ children, variant = 'default', onClick, className = '', size = 'md' }: ChipProps) {
  const styles: Record<ChipVariant, { bg: string; color: string; border?: string }> = {
    default: { bg: '#E8E6E1', color: '#6B6B6B' },
    accent: { bg: 'rgba(255,77,61,0.12)', color: '#FF4D3D' },
    dark: { bg: '#1A1A1A', color: '#FFFFFF' },
    ghost: { bg: 'transparent', color: '#6B6B6B', border: '1.5px solid #DCDBD7' },
  };

  const s = styles[variant];
  const paddingY = size === 'sm' ? '3px' : '5px';
  const paddingX = size === 'sm' ? '10px' : '14px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold select-none whitespace-nowrap ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      style={{
        background: s.bg,
        color: s.color,
        border: s.border || 'none',
        borderRadius: '999px',
        paddingTop: paddingY,
        paddingBottom: paddingY,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        fontSize,
        letterSpacing: '0.01em',
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </span>
  );
}
