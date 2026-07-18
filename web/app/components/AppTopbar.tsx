"use client";
import { usePathname } from "next/navigation";
import { useConnection } from "wagmi";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/app": { title: "Overview", sub: "Your Monad wallet, checked before you sign." },
  "/app/proof": { title: "On-chain proof", sub: "Real transactions, real balance deltas, nothing simulated." },
  "/app/integrate": { title: "Integrate", sub: "Drop the same pre-flight engine into your own code." },
};

export function AppTopbar() {
  const pathname = usePathname();
  const { address, isConnected } = useConnection();
  // next.config.mjs sets trailingSlash: true (required for nested static-export routes), so
  // usePathname() returns "/app/proof/" not "/app/proof" — normalize before the lookup.
  const normalized = (pathname ?? "/app").replace(/\/$/, "") || "/app";
  const page = TITLES[normalized] ?? TITLES["/app"]!;

  return (
    <div className="app-topbar">
      <div>
        <div className="app-topbar-title">{page.title}</div>
        <div className="app-topbar-sub">{page.sub}</div>
      </div>
      <div className={`app-status-pill ${isConnected ? "connected" : ""}`}>
        <span className="dot" />
        {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "No wallet connected"}
      </div>
    </div>
  );
}
