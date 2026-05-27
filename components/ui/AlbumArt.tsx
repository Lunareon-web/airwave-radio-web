'use client';

import { useMemo } from 'react';
import Image from 'next/image';

const COLOR_PALETTES = [
  ['#1a1a2e', '#16213e'],
  ['#0d1b2a', '#1b2838'],
  ['#2d1b69', '#11998e'],
  ['#fc4a1a', '#f7b733'],
  ['#141e30', '#243b55'],
  ['#232526', '#414345'],
  ['#0f0c29', '#302b63'],
  ['#0a0a0a', '#1a1a1a'],
  ['#200122', '#6f0000'],
  ['#1d2671', '#c33764'],
  ['#11998e', '#38ef7d'],
  ['#2193b0', '#6dd5ed'],
];

interface AlbumArtProps {
  artist?: string;
  track?: string;
  coverArt?: string;
  size?: number;
  rounded?: 'full' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function AlbumArt({ artist = '', track = '', coverArt, size = 56, rounded = 'xl', className = '' }: AlbumArtProps) {
  const palette = useMemo(() => {
    const key = `${artist}${track}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
    }
    return COLOR_PALETTES[Math.abs(hash) % COLOR_PALETTES.length];
  }, [artist, track]);

  const initials = useMemo(() => {
    const words = artist.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '♪';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [artist]);

  const radiusClass = {
    full: 'rounded-full',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
  }[rounded];

  if (coverArt) {
    return (
      <div
        className={`relative overflow-hidden flex-shrink-0 ${radiusClass} ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={coverArt}
          alt={`${artist} - ${track}`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  const fontSize = size <= 36 ? size * 0.3 : size * 0.28;

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center ${radiusClass} ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
      }}
    >
      <span
        className="font-bold text-white select-none"
        style={{ fontSize, letterSpacing: '0.05em' }}
      >
        {initials}
      </span>
    </div>
  );
}
