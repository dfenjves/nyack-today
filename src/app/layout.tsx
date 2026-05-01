import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyacktoday.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nyack Today - What's Happening in Nyack",
    template: "%s | Nyack Today",
  },
  description: "Find events, shows, and things to do in and around Nyack, NY. Tonight's events, weekend activities, and more.",
  keywords: ["Nyack", "events", "things to do", "Hudson Valley", "concerts", "shows", "family activities", "Nyack NY", "Rockland County", "live music", "comedy shows"],
  authors: [{ name: "Nyack Today" }],
  creator: "Nyack Today",
  publisher: "Nyack Today",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Nyack Today",
    title: "Nyack Today - What's Happening in Nyack",
    description: "Find events, shows, and things to do in and around Nyack, NY. Tonight's events, weekend activities, and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nyack Today - What's Happening in Nyack",
    description: "Find events, shows, and things to do in and around Nyack, NY.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E3A2F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${fraunces.variable} antialiased min-h-screen`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
