import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { siteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every relative URL in any page's metadata — canonical links, Open Graph
  // images — is resolved against this. Without it Next emits relative values
  // that a crawler or a link unfurler cannot resolve, so share cards silently
  // lose their images.
  metadataBase: siteUrl(),
  // Per-shop pages override this; it only shows on the root and on errors.
  title: "Storefront",
  description: "Shop the catalog.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
