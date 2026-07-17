"use client";
import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther, type Address } from "viem";
import { monadTestnet } from "@codeswithroh/reckon-core";
import { scanWalletActivity, type WalletScanResult } from "../lib/walletScan";

const client = createPublicClient({ chain: monadTestnet, transport: http() });
const EXPLORER = "https://testnet.monadexplorer.com";
const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const trimMon = (wei: bigint) => {
  const n = Number(formatEther(wei));
  return n === 0 ? "0" : n < 0.0001 && n > 0 ? "<0.0001" : n.toPrecision(3).replace(/\.?0+$/, "");
};

export function WalletReport({ address }: { address: Address | null }) {
  const [result, setResult] = useState<WalletScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    scanWalletActivity(client, address)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Scan failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) {
    return (
      <div className="report-empty">
        Connect a wallet or paste an address above to see a real safety report: recent failed
        transactions, MON burned, and any outstanding risky approvals, scanned live from Monad
        testnet.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="report-empty">
        <span className="spinner" />
        &nbsp;Scanning recent Monad testnet history for {address.slice(0, 6)}…{address.slice(-4)}…
      </div>
    );
  }

  if (error) {
    return <div className="report-empty" style={{ color: "var(--block)" }}>{error}</div>;
  }

  if (!result) return null;

  const clean = result.revertCount === 0 && result.riskyTxs.length === 0;

  return (
    <div>
      <div className="report-stats">
        <div className="report-stat">
          <div className="num">{result.txCount}</div>
          <div className="lbl">transactions found ({result.blocksScanned} blocks scanned)</div>
        </div>
        <div className="report-stat">
          <div className={`num ${result.revertCount > 0 ? "block" : "good"}`}>{result.revertCount}</div>
          <div className="lbl">reverted</div>
        </div>
        <div className="report-stat">
          <div className={`num ${result.totalBurnedWei > 0n ? "block" : "good"}`}>
            {trimMon(result.totalBurnedWei)} MON
          </div>
          <div className="lbl">burned on failed transactions</div>
        </div>
        <div className="report-stat">
          <div className={`num ${result.riskyTxs.length > 0 ? "warn" : "good"}`}>
            {result.riskyTxs.length}
          </div>
          <div className="lbl">approvals granted in this window</div>
        </div>
      </div>

      {clean && (
        <p className="report-clean">
          ✓ Clean record in the scanned window: no reverted transactions, no approval-granting
          calls found.
        </p>
      )}

      {result.revertedTxs.length > 0 && (
        <div className="report-section">
          <h4>Reverted transactions (full gas limit still charged)</h4>
          {result.revertedTxs.map((t) => (
            <div className="report-row" key={t.hash}>
              <a className="txlink" href={`${EXPLORER}/tx/${t.hash}`}>
                {shortHash(t.hash)} ↗
              </a>
              <span className="amt burn">{trimMon(t.burnedWei)} MON burned</span>
            </div>
          ))}
        </div>
      )}

      {result.riskyTxs.length > 0 && (
        <div className="report-section">
          <h4>Approvals granted (review if you don&apos;t recognize them)</h4>
          {result.riskyTxs.map((t) => (
            <div key={t.hash} className="report-row-flags">
              <a className="txlink" href={`${EXPLORER}/tx/${t.hash}`}>
                {shortHash(t.hash)} ↗
              </a>
              {t.flags.map((f, i) => (
                <div key={i} className={`risk-flag ${f.severity}`}>
                  <span className="risk-flag-sev">{f.severity.toUpperCase()}</span>
                  <span className="risk-flag-msg">{f.message}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {result.timedOut && (
        <p className="blurb" style={{ marginTop: 10 }}>
          Scan hit its time limit and stopped early — results are from a partial window, not full
          history.
        </p>
      )}
    </div>
  );
}
