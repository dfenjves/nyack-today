import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-50 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
