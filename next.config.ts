import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'discord.js',
    '@discordjs/ws',
    'zlib-sync',
    'bufferutil',
    'utf-8-validate'
  ],
};

export default nextConfig;
