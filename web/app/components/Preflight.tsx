"use client";
import { useState } from "react";
import { PRESETS, type Preset } from "../lib/presets";
import { runPreflight, type PreflightResult } from "../lib/preflightClient";

type Verdict = PreflightResult;

const short = (v: string | null, n = 8) =>
  v && v.length > n * 2 ? `${v.slice(0, n)}…${v.slice(-4)}` : v ?? "n/a";

const trimMon = (v: string | null) => {
  if (!v) return "n/a";
  const n = Number(v);
  return n === 0 ? "0" : n.toPrecision(4).replace(/\.?0+$/, "");
};

export function PreflightWidget() {
  const [tx, setTx] = useState<Preset["tx"]>(PRESETS[0]!.tx);
  const [activeId, setActiveId] = useState<string>(PRESETS[0]!.id);
  const [blurb, setBlurb] = useState<string>(PRESETS[0]!.blurb);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: Preset) {
    setActiveId(p.id);
    setTx(p.tx);
    setBlurb(p.blurb);
    setVerdict(null);
    setError(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setVerdict(null);
    try {
      const result = await runPreflight(tx);
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
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={`chip ${activeId === p.id ? "active" : ""}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="blurb">{blurb}</p>

          <div className="field">
            <label>from</label>
            <input
              value={tx.from}
              onChange={(e) => setTx({ ...tx, from: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>to</label>
            <input
              value={tx.to ?? ""}
              onChange={(e) => setTx({ ...tx, to: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>calldata</label>
            <input
              value={tx.data ?? ""}
              onChange={(e) => setTx({ ...tx, data: e.target.value })}
              spellCheck={false}
              placeholder="0x"
            />
          </div>

          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> &nbsp;Pre-flighting…
              </>
            ) : (
              "Pre-flight on Monad testnet →"
            )}
          </button>
        </div>

        <div className="panel">
          <div className="verdict">
            {!verdict && !error && !loading && (
              <div className="verdict-empty">
                Pick a scenario and pre-flight it.
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
            {verdict && (
              <>
                <div className={`badge ${verdict.willRevert ? "block" : "ok"}`}>
                  {verdict.willRevert ? "● BLOCK: would revert" : "● OK: safe to send"}
                </div>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
