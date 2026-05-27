'use client';

interface FreqBarsProps {
  active?: boolean;
  color?: string;
  size?: 'sm' | 'md';
}

export function FreqBars({ active = true, color = '#FF4D3D', size = 'sm' }: FreqBarsProps) {
  const barCount = 4;
  const barWidth = size === 'sm' ? 2 : 3;
  const maxHeight = size === 'sm' ? 12 : 16;
  const gap = size === 'sm' ? 2 : 3;

  const delays = ['0s', '0.2s', '0.1s', '0.3s'];
  const heights = [60, 100, 70, 85];

  return (
    <div
      className="flex items-end"
      style={{ gap, height: maxHeight, flexShrink: 0 }}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            background: color,
            borderRadius: 1,
            height: active ? `${heights[i]}%` : '30%',
            animationName: active ? 'freqBounce' : 'none',
            animationDuration: '0.8s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationDelay: delays[i],
            transition: 'height 0.3s ease',
          }}
        />
      ))}
      <style>{`
        @keyframes freqBounce {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
