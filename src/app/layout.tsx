import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Space_Mono } from "next/font/google";
import { SITE_URL } from "@/config/site";
import { ServiceWorker } from "./ServiceWorker";
import "./globals.css";

// Fonts are downloaded at build time and served from our own site.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Trailmix", template: "%s · Trailmix" },
  description: "Pick the terrain. We'll bring the noise.",
  applicationName: "Trailmix",
  appleWebApp: {
    capable: true,
    title: "Trailmix",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    // Home-screen icons for every iPhone and iPad size; all drawn from src/brand/AppIcon.tsx.
    apple: [120, 152, 167, 180].map((s) => ({ url: `/icons/icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png" })),
  },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16130F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${spaceMono.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
