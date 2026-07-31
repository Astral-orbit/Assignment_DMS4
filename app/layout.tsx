import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://loci-trip-conductor.astrally1022.chatgpt.site"),
  title: "LOCI — AI Trip Conductor",
  description:
    "Build a trip around live context: places, routes, weather, style, and local voices.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "LOCI — Your trip, in context.",
    description: "Places, timing, routes, weather, style — composed into one living plan.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOCI — Your trip, in context.",
    description: "One living plan for every moving part of your journey.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
