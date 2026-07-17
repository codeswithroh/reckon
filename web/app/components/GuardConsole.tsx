"use client";
import { useCallback, useRef, useState } from "react";
import { useConnection } from "wagmi";
import {
  createGuardedProvider,
  type Eip1193Provider,
  type PreflightVerdict,
} from "@codeswithroh/reckon-sdk";
import { narrateVerdict } from "../lib/narrate";
import type { PreflightResult, RiskFlagView } from "../lib/preflightClient";

function jsonSafeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  return Object.fromEntries(
    Object.entries(details).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]),
  );
}

/** Adapt the SDK's raw (bigint-bearing) verdict into the JSON-safe shape `narrate.ts` expects. */
function toResultView(v: PreflightVerdict): PreflightResult {
  return {
    ok: v.ok,
    willRevert: v.willRevert,
    revertReason: v.revertReason ?? null,
    recommendedGasLimit: v.recommendedGasLimit?.toString() ?? null,
    gasPrice: v.gasPrice.toString(),
    worstCaseFeeMON: v.worstCaseFeeMON ?? null,
    naiveGasLimit: v.naiveGasLimit?.toString() ?? null,
    savingsVsNaiveMON: v.savingsVsNaiveMON ?? null,
    notes: v.notes,
    riskFlags: v.riskFlags.map((f) => ({ ...f, details: jsonSafeDetails(f.details) })) as RiskFlagView[],
    riskSummary: v.riskSummary ?? null,
    hasCriticalRisk: v.riskFlags.some((f) => f.severity === "critical"),
  };
}

interface GuardEvent {
  id: number;
  to?: string;
  /**
   * `createGuardedProvider`'s `mode: "block"` only throws (hard-stops) on a doomed tx that would
   * revert. A critical-risk-but-succeeding call (e.g. an unlimited approve) is NOT thrown, by
   * design, an approve() can be entirely intentional, so it's forwarded to the wallet with a
   * flag instead. The feed must reflect that distinction honestly, not just show "blocked" for
   * both.
   */
  outcome: "blocked" | "flagged" | "allowed";
  narrative: string;
}

type WindowWithEthereum = Window & { ethereum?: Eip1193Provider };

export function GuardConsole() {
  const { isConnected, connector } = useConnection();
  const [active, setActive] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [events, setEvents] = useState<GuardEvent[]>([]);
  const [checkedCount, setCheckedCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [savedMON, setSavedMON] = useState(0);
  const originalRef = useRef<Eip1193Provider | null>(null);
  const idRef = useRef(0);

  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !connector) return;
    setEnableError(null);
    setEnabling(true);
    try {
      // Ask wagmi for the *actual* provider behind the connected connector, rather than trusting
      // a possibly-stale `window.ethereum` global (the source of the original flakiness: multiple
      // extensions racing to own that one object).
      const provider = (await connector.getProvider()) as Eip1193Provider;
      const win = window as unknown as WindowWithEthereum;
      originalRef.current = win.ethereum ?? null;
      const guarded = createGuardedProvider(provider, {
        mode: "block",
        onVerdict: (verdict, tx) => {
          const view = toResultView(verdict);
          const outcome: GuardEvent["outcome"] = verdict.willRevert
            ? "blocked"
            : view.hasCriticalRisk
              ? "flagged"
              : "allowed";
          setCheckedCount((c) => c + 1);
          if (outcome === "blocked") setBlockedCount((c) => c + 1);
          if (outcome === "flagged") setFlaggedCount((c) => c + 1);
          setSavedMON((s) => s + Number(verdict.savingsVsNaiveMON ?? "0"));
          idRef.current += 1;
          setEvents((evs) =>
            [
              {
                id: idRef.current,
                to: typeof tx.to === "string" ? tx.to : undefined,
                outcome,
                narrative: narrateVerdict(view),
              },
              ...evs,
            ].slice(0, 20),
          );
        },
      });
      // Dapps that check the ambient `window.ethereum` global (the vast majority) pick up the
      // guarded version for the rest of this tab. Wallets only reachable via EIP-6963 announce
      // events (no window.ethereum shim) aren't interceptable this way — a real gap, not silently
      // pretended away.
      win.ethereum = guarded;
      setActive(true);
    } catch (e) {
      setEnableError(e instanceof Error ? e.message : "Could not read the wallet's provider.");
    } finally {
      setEnabling(false);
    }
  }, [connector]);

  const disable = useCallback(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as WindowWithEthereum;
    if (originalRef.current) win.ethereum = originalRef.current;
    originalRef.current = null;
    setActive(false);
  }, []);

  if (!isConnected) {
    return (
      <div className="guard-console-empty">
        <p className="blurb">
          Connect a real wallet above to turn this on. Once enabled, Reckon wraps its provider in
          this browser tab: every transaction any Monad testnet dApp asks it to sign gets
          pre-flighted first, before your wallet ever prompts you.
        </p>
      </div>
    );
  }

  const trimmedSaved = savedMON > 0 ? savedMON.toPrecision(3).replace(/\.?0+$/, "") : "0";

  return (
    <div className="guard-console">
      <div className="guard-status-row">
        <div className={`guard-pill ${active ? "on" : "off"}`}>
          <span className="guard-dot" />
          {active ? "Guard active" : "Guard off"}
        </div>
        {active ? (
          <button className="btn btn-sm" onClick={disable}>
            Disable
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={enable} disabled={enabling}>
            {enabling ? "Enabling…" : "Enable Reckon Guard"}
          </button>
        )}
        {active && (
          <div className="guard-stats">
            <span>{checkedCount} checked</span>
            <span>{blockedCount} blocked</span>
            <span>{flaggedCount} flagged</span>
            <span>{trimmedSaved} MON saved</span>
          </div>
        )}
      </div>

      {enableError && <p className="wallet-error">{enableError}</p>}

      {active && (
        <p className="blurb" style={{ marginTop: 10 }}>
          Reckon is wrapping this tab&apos;s wallet provider right now. Go use any Monad testnet
          dApp in this browser tab, a faucet, a swap, an NFT mint, and every{" "}
          <span className="mono">eth_sendTransaction</span> it tries gets checked here first,
          before your wallet ever opens.
        </p>
      )}

      {events.length > 0 && (
        <div className="guard-feed">
          {events.map((e) => (
            <div key={e.id} className={`guard-feed-row ${e.outcome}`}>
              <span className="guard-feed-badge">
                {e.outcome === "blocked" ? "BLOCKED" : e.outcome === "flagged" ? "FLAGGED" : "ALLOWED"}
              </span>
              <span className="guard-feed-narrative">{e.narrative}</span>
              {e.to && (
                <span className="guard-feed-to mono">
                  → {e.to.slice(0, 6)}…{e.to.slice(-4)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
