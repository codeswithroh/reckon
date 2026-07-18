"use client";
import { useState } from "react";
import { useConnection } from "wagmi";
import {
  createGuardedProvider,
  ReckonRefusedError,
  type Eip1193Provider,
  type PreflightVerdict,
} from "@codeswithroh/reckon-sdk";
import { PRESETS } from "../lib/presets";
import { narrateVerdict, narrateRiskFlag } from "../lib/narrate";
import type { PreflightResult, RiskFlagView } from "../lib/preflightClient";
import { Icon, type IconName } from "./Icon";

const EXPLORER = "https://testnet.monadexplorer.com";

const ACTIONS: Array<{ presetId: string; icon: IconName; title: string; tagline: string }> = [
  {
    presetId: "unlimited-approve",
    icon: "alert-triangle",
    title: "“Claim” button on a lookalike site",
    tagline: "Requests unlimited token approval. Reckon should stop this before your wallet ever opens.",
  },
  {
    presetId: "healthy-read",
    icon: "check-circle-2",
    title: "Ordinary contract read",
    tagline: "A normal, well-formed call. Reckon should let this through to your wallet with a tight gas limit.",
  },
  {
    presetId: "pyth-bogus",
    icon: "x-circle",
    title: "Call to a broken function",
    tagline: "Would revert on-chain. Reckon should refuse to send it before your wallet ever prompts.",
  },
];

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

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "blocked"; view: PreflightResult }
  | { kind: "forwarded"; view: PreflightResult; hash: string }
  | { kind: "rejected"; view: PreflightResult | null; detail: string }
  | { kind: "error"; message: string };

export function GuardConsole({
  onOutcome,
}: {
  /** Lets a parent (e.g. the dashboard's KPI row) tally session results without owning the send logic. */
  onOutcome?: (view: PreflightResult, kind: "blocked" | "forwarded" | "rejected") => void;
} = {}) {
  const { isConnected, connector, address } = useConnection();
  const [activeId, setActiveId] = useState<string>(ACTIONS[0]!.presetId);
  const [state, setState] = useState<SendState>({ kind: "idle" });

  async function send(presetId: string) {
    if (!connector || !address) return;
    setActiveId(presetId);
    setState({ kind: "sending" });
    const preset = PRESETS.find((p) => p.id === presetId)!;
    let verdict: PreflightVerdict | null = null;
    try {
      // Fetched fresh, from wagmi's connector, every send — never a stale or ambiguous
      // window.ethereum reference, and never mutates any browser global.
      const provider = (await connector.getProvider()) as Eip1193Provider;
      const guarded = createGuardedProvider(provider, {
        mode: "block",
        onVerdict: (v) => {
          verdict = v;
        },
      });
      const hash = (await guarded.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: preset.tx.to, data: preset.tx.data, value: preset.tx.value }],
      })) as string;
      const view = toResultView(verdict!);
      setState({ kind: "forwarded", view, hash });
      onOutcome?.(view, "forwarded");
    } catch (e) {
      if (e instanceof ReckonRefusedError && verdict) {
        const view = toResultView(verdict);
        setState({ kind: "blocked", view });
        onOutcome?.(view, "blocked");
      } else if (verdict) {
        // Reckon let it through to the wallet; the wallet itself rejected or errored
        // (e.g. the user clicked "Reject" on the signing prompt) — a different outcome
        // from Reckon refusing to send it, so it gets a different label.
        const view = toResultView(verdict);
        setState({
          kind: "rejected",
          view,
          detail: e instanceof Error ? e.message : "Rejected in wallet.",
        });
        onOutcome?.(view, "rejected");
      } else {
        setState({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      }
    }
  }

  if (!isConnected) {
    return (
      <div className="guard-console-empty">
        <p className="blurb">
          Connect a real wallet above to run this. Each button below sends that exact transaction
          through your actual connected wallet, wrapped by Reckon first, a real send, not a
          simulation: the doomed one should never reach a signing prompt, the risky one should
          reach your wallet flagged, and the healthy one should reach it with a tightened gas
          limit.
        </p>
      </div>
    );
  }

  return (
    <div className="widget">
      <div className="widget-grid">
        <div className="panel left">
          <p className="blurb" style={{ marginBottom: 14 }}>
            These go through your real connected wallet, not a preflight-only check. Reckon wraps
            it first: expect no popup at all for the broken call, a real signing prompt (flagged)
            for the risky approval, and a real signing prompt (tightened gas) for the healthy read.
          </p>
          <div className="action-cards">
            {ACTIONS.map((a) => (
              <button
                key={a.presetId}
                className={`action-card ${activeId === a.presetId ? "active" : ""}`}
                onClick={() => send(a.presetId)}
                disabled={state.kind === "sending"}
              >
                <span className={`action-icon ${a.icon}`}>
                  <Icon name={a.icon} size={18} />
                </span>
                <span className="action-title">{a.title}</span>
                <span className="action-tagline">{a.tagline}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="verdict">
            {state.kind === "idle" && (
              <div className="verdict-empty">
                Pick an action on the left.
                <br />
                Sends a real <span className="mono">eth_sendTransaction</span> through your
                connected wallet on Monad testnet.
              </div>
            )}
            {state.kind === "sending" && (
              <div className="verdict-empty">
                Pre-flighting against live testnet, check your wallet for a prompt…
              </div>
            )}
            {state.kind === "error" && (
              <div className="verdict-empty" style={{ color: "var(--block)" }}>
                {state.message}
              </div>
            )}
            {state.kind === "blocked" && (
              <>
                <p className="narrative block">{narrateVerdict(state.view)}</p>
                <div className="badge block">● BLOCKED, never reached your wallet</div>
              </>
            )}
            {state.kind === "rejected" && (
              <>
                <p className={`narrative ${state.view?.hasCriticalRisk ? "warn" : "ok"}`}>
                  {state.view ? narrateVerdict(state.view) : ""}
                </p>
                <div className="badge warn">● Reached your wallet, then rejected: {state.detail}</div>
              </>
            )}
            {state.kind === "forwarded" && (
              <>
                <p className={`narrative ${state.view.hasCriticalRisk ? "warn" : "ok"}`}>
                  {narrateVerdict(state.view)}
                </p>
                <div className={`badge ${state.view.hasCriticalRisk ? "warn" : "ok"}`}>
                  ● SENT, <a className="txlink" href={`${EXPLORER}/tx/${state.hash}`}>view on explorer ↗</a>
                </div>
              </>
            )}

            {(state.kind === "blocked" || state.kind === "forwarded" || state.kind === "rejected") &&
              state.view &&
              state.view.riskFlags.length > 0 && (
                <div className="risk-flags">
                  {state.view.riskFlags.map((f, i) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
