import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Web3Provider } from "./components/Web3Provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const SITE_URL = "https://reckon-monad-seatbelt.netlify.app";
const DESCRIPTION =
  "On Monad you pay for the gas limit you declare, even when a tx reverts. Reckon pre-flights every transaction so you stop burning MON on failures and oversized limits.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Reckon: a transaction seatbelt for Monad",
  description: DESCRIPTION,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Reckon: a transaction seatbelt for Monad",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Reckon",
    images: [{ url: "/og-card.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reckon: a transaction seatbelt for Monad",
    description: DESCRIPTION,
    images: ["/og-card.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={
          {
            fontFamily: "var(--sans)",
            ["--sans" as string]: `${inter.style.fontFamily}, system-ui, sans-serif`,
            ["--mono" as string]: `${mono.style.fontFamily}, ui-monospace, monospace`,
          } as React.CSSProperties
        }
        className={`${inter.variable} ${mono.variable}`}
      >
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
