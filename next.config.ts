import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i1.sndcdn.com' },
      { protocol: 'https', hostname: 'i2.sndcdn.com' },
      { protocol: 'https', hostname: 'i3.sndcdn.com' },
      { protocol: 'https', hostname: 'i4.sndcdn.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
