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

export const metadata: Metadata = {
  title: "Nyack Today - What's Happening in Nyack",
  description: "Find events, shows, and things to do in and around Nyack, NY. Tonight's events, weekend activities, and more.",
  keywords: ["Nyack", "events", "things to do", "Hudson Valley", "concerts", "shows", "family activities"],
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
