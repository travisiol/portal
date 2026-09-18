import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { site } from "@/config/site";
import { CursorGlow, Footer, MobileNav, RoutePulse } from "@/components/layout/Chrome";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "@/components/wallet/Providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PORTAL — One route. Any chain.", template: "%s · PORTAL" },
  description: site.description,
  metadataBase: new URL(site.url),
  openGraph: { title: "PORTAL — One route. Any chain.", description: site.description, siteName: site.name, type: "website" },
  twitter: { card: "summary_large_image", title: "PORTAL — One route. Any chain.", description: site.description },
};

export const viewport: Viewport = { themeColor: "#050607", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <CursorGlow />
          <RoutePulse />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
