import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/m', destination: '/my/messages', permanent: true },
      { source: '/m/:id', destination: '/my/messages/:id', permanent: true },
      { source: '/sell', destination: '/my/selling/onboarding', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          // SEC-008: CSP moved to middleware.ts for nonce-based policy
          // SEC-039: X-DNS-Prefetch-Control set to 'off' to prevent navigation leakage
        ],
      },
    ];
  },
  output: 'standalone',
  serverExternalPackages: ['postgres', 'pino', 'pino-loki', 'pino-pretty', 'telnyx', 'ioredis', 'bullmq'],
  allowedDevOrigins: ['twicely.co', 'twicely.local', 'hub.twicely.co', 'hub.twicely.local'],
  transpilePackages: ['@puckeditor/core','@twicely/db','@twicely/auth','@twicely/casl','@twicely/commerce','@twicely/crosslister','@twicely/stripe','@twicely/email','@twicely/notifications','@twicely/ui','@twicely/utils','@twicely/logger','@twicely/storage','@twicely/realtime','@twicely/jobs','@twicely/subscriptions','@twicely/scoring','@twicely/finance','@twicely/search','@twicely/config','@twicely/sms','@twicely/geocoding'],
  images: {
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.twicely.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
