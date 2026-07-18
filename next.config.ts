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
};

export default nextConfig;
