import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Allow only same-origin frames to use the Media Session API.
            // This prevents the cross-origin YouTube iframe from registering
            // its own media session (which would steal the OS widget and hide
            // our prev/next track buttons on Android).
            key: 'Permissions-Policy',
            value: 'mediasession=(self)',
          },
        ],
      },
    ];
  },
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
