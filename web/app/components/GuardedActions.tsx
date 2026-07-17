"use client";
import { useState } from "react";
import { createGuardedProvider, ReckonRefusedError, type Eip1193Provider } from "@codeswithroh/reckon-sdk";
import { PRESETS, type Preset } from "../lib/presets";
import { runPreflight, type PreflightResult } from "../lib/preflightClient";
import { narrateVerdict, narrateRiskFlag } from "../lib/narrate";
import { Icon, type IconName } from "./Icon";
import type { WalletState } from "./WalletConnect";

const ACTIONS: Array<{
  presetId: string;
  icon: IconName;
  title: string;
  tagline: string;
}> = [
  {
    presetId: "unlimited-approve",
    icon: "alert-triangle",
    title: "“Claim” button on a lookalike site",
    tagline: "The most common drain vector: an innocuous claim button that actually requests unlimited token approval.",
  },
  {
    presetId: "healthy-read",
    icon: "check-circle-2",
    title: "Ordinary contract read",
    tagline: "A normal, well-formed call. What most of your transactions should look like.",
  },
  {
    presetId: "pyth-bogus",
    icon: "x-circle",
    title: "Call to a broken function",
    tagline: "Would fail on-chain and, on Monad, still charge the full declared gas limit.",
  },
];

const trimMon = (v: string | null) => {
  if (!v) return "n/a";
  const n = Number(v);
  return n === 0 ? "0" : n.toPrecision(4).replace(/\.?0+$/, "");
};

type WalletTryState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "blocked"; reason: string }
  | { kind: "allowed" };

export function GuardedActions({ wallet }: { wallet: WalletState }) {
  const [activeId, setActiveId] = useState<string>(ACTIONS[0]!.presetId);
  const [verdict, setVerdict] = useState<PreflightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletTry, setWalletTry] = useState<WalletTryState>({ kind: "idle" });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advTx, setAdvTx] = useState<Preset["tx"]>(PRESETS[0]!.tx);

  const active = ACTIONS.find((a) => a.presetId === activeId)!;
  const activePreset = PRESETS.find((p) => p.id === activeId)!;

  async function runAction(presetId: string) {
    setActiveId(presetId);
    setVerdict(null);
    setError(null);
    setWalletTry({ kind: "idle" });
    setLoading(true);
    const preset = PRESETS.find((p) => p.id === presetId)!;
    try {
      const result = await runPreflight(preset.tx);
      setVerdict(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  async function tryOnRealWallet() {
    if (!wallet.address || !wallet.isRealWallet || typeof window === "undefined") return;
    const ethereum = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!ethereum) return;

    setWalletTry({ kind: "checking" });
    const guarded = createGuardedProvider(ethereum);
    try {
      await guarded.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: activePreset.tx.to, data: activePreset.tx.data }],
      });
      // Reckon allowed it through: the real wallet has now been asked to sign.
      setWalletTry({ kind: "allowed" });
    } catch (e) {
      if (e instanceof ReckonRefusedError) {
        setWalletTry({ kind: "blocked", reason: e.message });
      } else {
        setWalletTry({ kind: "idle" });
      }
    }
  }

  async function runAdvanced() {
    setVerdict(null);
    setError(null);
    setLoading(true);
    try {
      const result = await runPreflight(advTx);
      setVerdict(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="widget" data-reveal>
      <div className="widget-grid">
        <div className="panel left">
          <p className="blurb" style={{ marginBottom: 14 }}>
            Three realistic scenarios. Pick one and Reckon evaluates it live, against Monad
            testnet, before anything is signed.
          </p>
          <div className="action-cards">
            {ACTIONS.map((a) => (
              <button
                key={a.presetId}
                className={`action-card ${activeId === a.presetId ? "active" : ""}`}
                onClick={() => runAction(a.presetId)}
                disabled={loading}
              >
                <span className={`action-icon ${a.icon}`}>
                  <Icon name={a.icon} size={18} />
                </span>
                <span className="action-title">{a.title}</span>
                <span className="action-tagline">{a.tagline}</span>
              </button>
            ))}
          </div>

          {wallet.address && wallet.isRealWallet && verdict && (
            <div className="wallet-try">
              <button className="btn" onClick={tryOnRealWallet} disabled={walletTry.kind === "checking"}>
                {walletTry.kind === "checking"
                  ? "Checking against your wallet…"
                  : "Try this on your connected wallet →"}
              </button>
              {walletTry.kind === "blocked" && (
                <p className="wallet-try-result blocked">
                  🛑 Reckon blocked this before your wallet was ever asked to sign. Your wallet
                  popup never opened.
                </p>
              )}
              {walletTry.kind === "allowed" && (
                <p className="wallet-try-result allowed">
                  ✓ Reckon approved this and forwarded it to your wallet. Check your wallet, if a
                  prompt appeared, you can safely reject it, this is just a demo.
                </p>
              )}
            </div>
          )}

          <button
            className="advanced-toggle"
            onClick={() => setAdvancedOpen((v) => !v)}
            type="button"
          >
            {advancedOpen ? "▾" : "▸"} Advanced: test a raw address + calldata
          </button>
          {advancedOpen && (
            <div className="advanced-panel">
              <div className="field">
                <label>from</label>
                <input
                  value={advTx.from}
                  onChange={(e) => setAdvTx({ ...advTx, from: e.target.value })}
                  spellCheck={false}
                />
              </div>
              <div className="field">
                <label>to</label>
                <input
                  value={advTx.to ?? ""}
                  onChange={(e) => setAdvTx({ ...advTx, to: e.target.value })}
                  spellCheck={false}
                />
              </div>
              <div className="field">
                <label>calldata</label>
                <input
                  value={advTx.data ?? ""}
                  onChange={(e) => setAdvTx({ ...advTx, data: e.target.value })}
                  spellCheck={false}
                  placeholder="0x"
                />
              </div>
              <button className="btn btn-primary" onClick={runAdvanced} disabled={loading}>
                {loading ? "Pre-flighting…" : "Pre-flight this →"}
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="verdict">
            {!verdict && !error && !loading && (
              <div className="verdict-empty">
                Pick an action on the left.
                <br />
                Runs a real <span className="mono">eth_estimateGas</span> against Monad testnet.
              </div>
            )}
            {loading && <div className="verdict-empty">Simulating against live testnet…</div>}
            {error && (
              <div className="verdict-empty" style={{ color: "var(--block)" }}>
                {error}
              </div>
            )}
            {verdict &&
              (() => {
                const blockedByRisk = !verdict.willRevert && verdict.hasCriticalRisk;
                const hardBlock = verdict.willRevert || blockedByRisk;
                const badgeClass = hardBlock ? "block" : verdict.riskFlags.length > 0 ? "warn" : "ok";
                const badgeText = verdict.willRevert
                  ? "● BLOCK: would revert"
                  : blockedByRisk
                    ? "● BLOCK: critical permission risk"
                    : verdict.riskFlags.length > 0
                      ? "● OK, with a flag: review before sending"
                      : "● OK: safe to send";
                return (
                  <>
                    <p className={`narrative ${badgeClass}`}>{narrateVerdict(verdict)}</p>
                    <div className={`badge ${badgeClass}`}>{badgeText}</div>

                    {verdict.riskFlags.length > 0 && (
                      <div className="risk-flags">
                        {verdict.riskFlags.map((f, i) => (
                          <div key={i} className={`risk-flag ${f.severity}`}>
                            <span className="risk-flag-sev">{f.severity.toUpperCase()}</span>
                            <span>
                              <span className="risk-flag-msg">{narrateRiskFlag(f)}</span>
                              <span className="risk-flag-technical">{f.message}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                      {verdict.willRevert ? (
                        <>
                          <div className="kv">
                            <span className="k">revert reason</span>
                            <span className="v block">{verdict.revertReason ?? "unknown"}</span>
                          </div>
                          <div className="kv">
                            <span className="k">Reckon action</span>
                            <span className="v">not broadcast</span>
                          </div>
                          <div className="kv">
                            <span className="k">MON saved vs naive send</span>
                            <span className="v good">{trimMon(verdict.savingsVsNaiveMON)} MON</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="kv">
                            <span className="k">recommended gas limit</span>
                            <span className="v">{verdict.recommendedGasLimit}</span>
                          </div>
                          <div className="kv">
                            <span className="k">naive wallet limit</span>
                            <span className="v">{verdict.naiveGasLimit}</span>
                          </div>
                          <div className="kv">
                            <span className="k">worst-case cost</span>
                            <span className="v">{trimMon(verdict.worstCaseFeeMON)} MON</span>
                          </div>
                          <div className="kv">
                            <span className="k">MON saved vs naive</span>
                            <span className="v good">{trimMon(verdict.savingsVsNaiveMON)} MON</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      {verdict.notes.map((n, i) => (
                        <p className="note" key={i}>
                          {n}
                        </p>
                      ))}
                    </div>
                  </>
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
}
