'use client';

interface VinylProps {
  isPlaying?: boolean;
  size?: number;
  coverArt?: string;
  artist?: string;
}

export function Vinyl({ isPlaying = false, size = 200, coverArt, artist = '' }: VinylProps) {
  const labelSize = size * 0.4;
  const initials = artist.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '♪';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #2a2a2a, #0a0a0a)',
        boxShadow: isPlaying
          ? '0 8px 40px rgba(255,77,61,0.3), 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        animation: isPlaying ? 'spin 3s linear infinite' : 'none',
      }}
    >
      {/* Grooves */}
      {[0.82, 0.72, 0.62, 0.52].map((ratio, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size * ratio,
            height: size * ratio,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        />
      ))}
      {/* Label */}
      <div
        className="absolute rounded-full flex items-center justify-center overflow-hidden"
        style={{
          width: labelSize,
          height: labelSize,
          background: coverArt ? undefined : 'radial-gradient(135deg, #FF4D3D, #c0392b)',
        }}
      >
        {coverArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverArt} alt={artist} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: labelSize * 0.25 }}>{initials}</span>
        )}
      </div>
      {/* Center hole */}
      <div
        className="absolute rounded-full"
        style={{ width: size * 0.06, height: size * 0.06, background: '#0a0a0a' }}
      />
    </div>
  );
}
