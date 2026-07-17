"use client";
import { useState } from "react";
import { WalletConnect, type WalletState } from "./WalletConnect";
import { WalletReport } from "./WalletReport";
import { GuardedActions } from "./GuardedActions";

export function DashboardApp() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, isRealWallet: false });

  return (
    <>
      <section style={{ paddingTop: 4 }}>
        <div className="sec-head">
          <span className="sec-num">01</span>
          <h2>Check your wallet</h2>
        </div>
        <p className="sec-sub">
          Connect a wallet or paste any Monad address. Reckon scans its real recent activity, no
          calldata typing required.
        </p>
        <div className="report-card" data-reveal>
          <WalletConnect onChange={setWallet} />
          <div style={{ marginTop: 18 }}>
            <WalletReport address={wallet.address} />
          </div>
        </div>
      </section>

      <section>
        <div className="sec-head">
          <span className="sec-num">02</span>
          <h2>Try it live</h2>
        </div>
        <GuardedActions wallet={wallet} />
      </section>
    </>
  );
}
