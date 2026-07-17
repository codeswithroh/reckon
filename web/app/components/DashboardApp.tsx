"use client";
import { useState } from "react";
import { WalletConnect, type WalletState } from "./WalletConnect";
import { GuardConsole } from "./GuardConsole";
import { WalletReport } from "./WalletReport";
import { GuardedActions } from "./GuardedActions";

export function DashboardApp() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, isRealWallet: false });

  return (
    <>
      <section style={{ paddingTop: 4 }}>
        <div className="sec-head">
          <span className="sec-num">01</span>
          <h2>Connect your wallet</h2>
        </div>
        <p className="sec-sub">
          Connect a real wallet to turn on live protection below, or paste any Monad address to
          pull up its history.
        </p>
        <div className="report-card" data-reveal>
          <WalletConnect onChange={setWallet} />
        </div>
      </section>

      <section>
        <div className="sec-head">
          <span className="sec-num">02</span>
          <h2>Live guard</h2>
        </div>
        <p className="sec-sub">
          Three real sends through your actual connected wallet, wrapped by Reckon first, not a
          preflight-only check. Watch the doomed one never reach a signing prompt at all.
        </p>
        <div className="report-card" data-reveal>
          <GuardConsole />
        </div>
      </section>

      <section>
        <div className="sec-head">
          <span className="sec-num">03</span>
          <h2>Your wallet&apos;s real history</h2>
        </div>
        <p className="sec-sub">
          Recent failed transactions, MON burned, and any outstanding risky approvals, scanned
          live from Monad testnet.
        </p>
        <div className="report-card" data-reveal>
          <WalletReport wallet={wallet} />
        </div>
      </section>

      <section>
        <div className="sec-head">
          <span className="sec-num">04</span>
          <h2>No wallet? See it work instantly</h2>
        </div>
        <GuardedActions />
      </section>
    </>
  );
}
