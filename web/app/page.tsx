import Link from "next/link";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { RevealController } from "./components/Reveal";
import { HeroTimeline } from "./components/HeroTimeline";
import { HeroDiagram } from "./components/HeroDiagram";
import { GasChargeDiagram } from "./components/GasChargeDiagram";
import { BarChart } from "./components/BarChart";
import { Icon } from "./components/Icon";
import { CountUp } from "./components/CountUp";
import demo from "./lib/demo-results.json";

export default function LandingPage() {
  return (
    <div className="wrap">
      <RevealController />
      <Header variant="landing" />

      {/* 1. HERO */}
      <header className="hero">
        <HeroTimeline>
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Monad testnet &middot; live</span>
              <h1>
                A transaction seatbelt
                <br />
                for <span className="accent">Monad</span>.
              </h1>
              <p className="tagline">// a screenshot can lie. a receipt can&apos;t.</p>
              <p className="subhead">
                On Monad you pay for the gas limit you declare, <strong>not</strong> the gas you
                use, and even when your transaction reverts. Reckon pre-flights every transaction:
                it simulates it, refuses to broadcast doomed ones, and sets the tightest correct
                gas limit.
              </p>
              <div className="cta-row">
                <Link className="btn btn-primary" href="/app">
                  Launch the app
                </Link>
                <a className="btn" href="https://github.com/codeswithroh/reckon">
                  Read the code
                </a>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="false">
              <HeroDiagram />
            </div>
          </div>
        </HeroTimeline>

        <div className="stats">
          <div className="stat" data-reveal>
            <div className="num good">
              <CountUp value={demo.reductionPct} decimals={2} suffix="%" />
            </div>
            <div className="lbl">less MON burned by a Reckon-guarded agent</div>
          </div>
          <div className="stat" data-reveal>
            <div className="num">
              <CountUp value={100} suffix="%" />
            </div>
            <div className="lbl">of failed txs charge the full gas limit on Monad</div>
          </div>
          <div className="stat" data-reveal>
            <div className="num accent">
              <CountUp value={3} />
            </div>
            <div className="lbl">surfaces: SDK &middot; MCP agent guard &middot; on-chain</div>
          </div>
          <div className="stat" data-reveal>
            <div className="num">
              <CountUp value={42} />
            </div>
            <div className="lbl">tests, all against live testnet + local EVM</div>
          </div>
        </div>
      </header>

      {/* 2. PROBLEM */}
      <section id="problem">
        <div className="sec-head">
          <span className="sec-num">01</span>
          <h2>The problem: you pay for the limit, not the usage</h2>
        </div>
        <div className="problem-grid">
          <div>
            <p className="sec-sub" style={{ marginBottom: 20 }}>
              Ethereum-model chains charge you for the gas your transaction actually consumed. Monad
              charges you for the gas limit you <em>declared</em>, whether you used it or not, and
              even when the transaction reverts. Set a loose limit (or let your wallet pad one for
              you) and you overpay on every single send.
            </p>
            <div className="incident-stats" data-reveal>
              <div className="incident-stat">
                <div className="num">
                  <CountUp value={112.7} decimals={1} prefix="$" suffix="K" />
                </div>
                <div className="lbl">burned by one Monad airdrop recipient on failed txs</div>
              </div>
              <div className="incident-stat">
                <div className="num">
                  <CountUp value={6} prefix="~" suffix="%" />
                </div>
                <div className="lbl">of Monad testnet transactions fail (vs 0.9% on Ethereum)</div>
              </div>
            </div>
          </div>
          <div className="section-visual" data-reveal>
            <GasChargeDiagram />
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section id="how-it-works">
        <div className="sec-head">
          <span className="sec-num">02</span>
          <h2>Three surfaces, one seatbelt</h2>
        </div>
        <p className="sec-sub">
          The same pre-flight engine, wherever your transactions originate from.
        </p>
        <div className="icon-surfaces">
          <div className="icon-card" data-reveal>
            <div className="icon-badge">
              <Icon name="terminal" />
            </div>
            <span className="tag">packages/sdk</span>
            <h3>Drop-in SDK</h3>
            <p>
              A viem wrapper: <span className="mono">preflight()</span>,{" "}
              <span className="mono">safeSend()</span>, and batch routing through the on-chain
              guard. Optionally learns a per-contract gas buffer from real chain history instead
              of a flat percentage. Add the seatbelt to any dApp or deploy script.
            </p>
          </div>
          <div className="icon-card" data-reveal>
            <div className="icon-badge">
              <Icon name="bot" />
            </div>
            <span className="tag">packages/agent</span>
            <h3>MCP agent guard</h3>
            <p>
              An MCP server exposing <span className="mono">reckon_preflight</span> so any AI
              agent checks every transaction before sending. It blocks reverts and flags
              permission-escalating calls (unlimited approvals, NFT operator grants) even when
              they&apos;d succeed, the pattern behind a real ~$175K agent-drain incident.
            </p>
          </div>
          <div className="icon-card" data-reveal>
            <div className="icon-badge">
              <Icon name="shield-check" />
            </div>
            <span className="tag">contracts/</span>
            <h3>On-chain GuardedExecutor</h3>
            <p>
              Bounded, predictable execution with per-caller policy, enforced on-chain outside any
              agent&apos;s control. EIP-7702 friendly.
            </p>
          </div>
        </div>
      </section>

      {/* 4. PROOF SUMMARY */}
      <section id="proof">
        <div className="sec-head">
          <span className="sec-num">03</span>
          <h2>Proof, not a promise</h2>
        </div>
        <p className="sec-sub">
          A real autonomous agent, run twice on live testnet: once naive, once Reckon-guarded.
        </p>
        <div className="proof-summary">
          <div className="section-visual" data-reveal>
            <BarChart
              data={[
                { label: "Naive agent", value: Number(demo.naiveTotalMON), colorVar: "var(--block)" },
                { label: "Reckon-guarded", value: Number(demo.reckonTotalMON), colorVar: "var(--ok)" },
              ]}
            />
          </div>
          <div data-reveal>
            <p className="sec-sub" style={{ marginBottom: 20 }}>
              Every number is a real balance delta, every hash is a real testnet transaction. No
              mocked state, anywhere.
            </p>
            <Link className="btn btn-primary" href="/app/proof">
              See the full on-chain evidence &rarr;
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
