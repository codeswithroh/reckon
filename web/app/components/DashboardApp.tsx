"use client";
import { useCallback, useState } from "react";
import { formatEther } from "viem";
import { WalletConnect, type WalletState } from "./WalletConnect";
import { GuardConsole } from "./GuardConsole";
import { WalletReport } from "./WalletReport";
import { GuardedActions } from "./GuardedActions";
import { StatCard } from "./StatCard";
import type { WalletScanResult } from "../lib/walletScan";
import type { PreflightResult } from "../lib/preflightClient";
import { GUARDED_EXECUTOR } from "../lib/presets";

const MONADSCAN = "https://testnet.monadscan.com";
const EXPLORER = "https://testnet.monadexplorer.com";

const trimMon = (wei: bigint) => {
  const n = Number(formatEther(wei));
  return n === 0 ? "0" : n < 0.0001 && n > 0 ? "<0.0001" : n.toPrecision(3).replace(/\.?0+$/, "");
};
const trimNum = (n: number) => (n === 0 ? "0" : n.toPrecision(3).replace(/\.?0+$/, ""));

export function DashboardApp() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, isRealWallet: false });
  const [scan, setScan] = useState<WalletScanResult | null>(null);
  const [sessionChecked, setSessionChecked] = useState(0);
  const [sessionBlocked, setSessionBlocked] = useState(0);
  const [sessionSavedMON, setSessionSavedMON] = useState(0);

  const handleOutcome = useCallback((view: PreflightResult, kind: "blocked" | "forwarded" | "rejected") => {
    setSessionChecked((c) => c + 1);
    if (kind === "blocked") setSessionBlocked((c) => c + 1);
    const saved = Number(view.savingsVsNaiveMON ?? "0");
    if (saved > 0) setSessionSavedMON((s) => s + saved);
  }, []);

  return (
    <>
      <div className="kpi-row">
        <StatCard
          icon="fuel"
          tone="block"
          value={scan ? `${trimMon(scan.totalBurnedWei)} MON` : "—"}
          label="MON burned on failed transactions"
        />
        <StatCard
          icon="alert-triangle"
          tone="warn"
          value={scan ? String(scan.riskyTxs.length) : "—"}
          label="Risky approvals still open"
        />
        <StatCard
          icon="shield-check"
          tone="accent"
          value={String(sessionChecked)}
          label={`Sends checked this session${sessionBlocked > 0 ? ` (${sessionBlocked} blocked)` : ""}`}
        />
        <StatCard
          icon="check-circle-2"
          tone="ok"
          value={`${trimNum(sessionSavedMON)} MON`}
          label="MON saved this session"
        />
      </div>

      <div className="dash-grid">
        <div className="dash-panel" data-reveal>
          <div className="dash-panel-head">
            <h3>Live guard</h3>
            <span className="dash-panel-tag">real sends</span>
          </div>
          <p className="dash-panel-sub">
            Three real sends through your connected wallet, wrapped by Reckon first. Watch the
            doomed one never reach a signing prompt.
          </p>
          <GuardConsole onOutcome={handleOutcome} />
        </div>

        <div className="dash-stack">
          <div className="dash-panel" data-reveal>
            <div className="dash-panel-head">
              <h3>Your wallet</h3>
            </div>
            <p className="dash-panel-sub">Connect a real wallet, or paste any Monad address.</p>
            <WalletConnect onChange={setWallet} />
          </div>

          <div className="dash-panel" data-reveal>
            <div className="dash-panel-head">
              <h3>Real history</h3>
            </div>
            <p className="dash-panel-sub">
              Recent failed transactions and outstanding risky approvals, scanned live.
            </p>
            <WalletReport wallet={wallet} onResult={setScan} />
          </div>
        </div>
      </div>

      <div className="dash-panel dash-panel-full" data-reveal>
        <div className="dash-panel-head">
          <h3>No wallet? See it work instantly</h3>
          <span className="dash-panel-tag">simulated preflight</span>
        </div>
        <GuardedActions />
      </div>

      <div className="dash-panel dash-panel-full" data-reveal>
        <div className="dash-panel-head">
          <h3>On-chain guard, deployed &amp; verified</h3>
        </div>
        <p className="dash-panel-sub">
          <span className="mono">GuardedExecutor</span>: bounded, predictable batch execution with
          per-caller policy (value caps, gas-price ceiling, target allowlist).
        </p>
        <div className="contract">
          <div>
            <div className="verified">&#10003; source-verified on MonadVision &amp; Monadscan</div>
            <div className="addr" style={{ marginTop: 8 }}>
              {GUARDED_EXECUTOR}
            </div>
          </div>
          <div className="cta-row" style={{ marginTop: 0 }}>
            <a className="btn" href={`${MONADSCAN}/address/${GUARDED_EXECUTOR}`}>
              Monadscan &#8599;
            </a>
            <a className="btn" href={`${EXPLORER}/address/${GUARDED_EXECUTOR}`}>
              Explorer &#8599;
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
