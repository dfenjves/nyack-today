import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'discord.js',
    '@discordjs/ws',
    'zlib-sync',
    'bufferutil',
    'utf-8-validate',
    'node-ical',
    'rrule-temporal',
    '@js-temporal/polyfill',
    'temporal-polyfill',
    'jsbi'
  ],
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.nyacktoday.com' }],
        destination: 'https://nyacktoday.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'nyack-today.vercel.app' }],
        destination: 'https://nyacktoday.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
