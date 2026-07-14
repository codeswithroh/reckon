import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Reckon: a transaction seatbelt for Monad",
  description:
    "On Monad you pay for the gas limit you declare, even when a tx reverts. Reckon pre-flights every transaction so you stop burning MON on failures and oversized limits.",
  icons: {
    icon: "/favicon.svg",
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
        {children}
      </body>
    </html>
  );
}
