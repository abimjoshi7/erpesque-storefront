import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { siteUrl } from "@/lib/site";

// Inter and JetBrains Mono are the design system's two faces — the same pair
// `DSTypography` names on the Flutter side. Self-hosted by `next/font`, so the
// shop makes no request to Google and the text does not reflow once they land.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
