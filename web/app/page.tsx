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
      <Header />

      {/* 1. HERO */}
      <header className="hero">
        <HeroTimeline>
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="hero-top-row">
                <span className="eyebrow">Monad testnet &middot; live</span>
                <span className="annotation-badge">// zero mocked transactions below</span>
              </div>
              <h1>
                On Monad,
                <br />
                failure <span className="accent">isn&apos;t free</span>.
              </h1>
              <p className="tagline">// a screenshot can lie. a receipt can&apos;t.</p>
              <p className="subhead">
                Every transaction is charged the full gas limit you declare, even when it reverts.
                I kept losing MON on transactions that failed, so I built Reckon: it checks each one
                before you sign, refuses the doomed ones before your wallet opens, and shows you
                exactly what you were about to lose.
              </p>
              <div className="cta-row">
                <Link className="btn btn-primary" href="/app">
                  Check your wallet
                </Link>
                <a className="btn" href="https://github.com/codeswithroh/reckon">
                  Read the code
                </a>
              </div>
            </div>
          </div>

          <div className="hero-collage">
            <div className="collage-card" data-reveal>
              <span className="collage-card-tag">live guard</span>
              <p className="collage-card-text">
                &ldquo;This transaction would revert. Reckon refuses to send it.&rdquo;
              </p>
              <div className="badge block" style={{ marginTop: 10 }}>
                ● BLOCKED, never reached your wallet
              </div>
            </div>
            <div className="collage-card" data-reveal>
              <span className="collage-card-tag">packages/core</span>
              <div className="code" style={{ padding: "12px 14px", fontSize: 12, marginTop: 8 }}>
                <div>
                  <span className="k">const</span> v = <span className="k">await</span> reckon.
                  <span className="f">preflight</span>(tx)
                </div>
                <div>
                  <span className="c">// willRevert: false</span>
                </div>
                <div>
                  <span className="c">// recommendedGasLimit: 23,838n</span>
                </div>
              </div>
            </div>
            <div className="collage-card" data-reveal>
              <span className="collage-card-tag">real balances, same agent</span>
              <div className="collage-stat-row">
                <div>
                  <span className="collage-stat-num block">0.0408</span>
                  <span className="collage-stat-lbl">naive MON burned</span>
                </div>
                <div>
                  <span className="collage-stat-num ok">0.0024</span>
                  <span className="collage-stat-lbl">reckon-guarded</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-tags" data-reveal>
            <span className="tag-chip">on-chain</span>
            <span className="tag-chip">no mocks</span>
            <span className="tag-chip">live testnet</span>
            <span className="tag-chip">open source</span>
          </div>

          <div className="proof-strip" data-reveal>
            <div className="proof-strip-head">Verified on-chain, not a promise</div>
            <div className="proof-chips">
              <a
                className="proof-chip"
                href="https://testnet.monadexplorer.com/tx/0xb613575a6f9dc5107e4ff9a0bc76bcb64dea3ec220da775aa708c2f470b79ae7"
              >
                <span className="dot" />
                0xb613&hellip;9ae7 &#8599;
              </a>
              <a
                className="proof-chip"
                href="https://testnet.monadexplorer.com/tx/0xb2e92e5e8969f42ceb8e1b9d4d9cbcca6faf101b2afc4ea2b36c6ddcbc842eca"
              >
                <span className="dot" />
                0xb2e9&hellip;2eca &#8599;
              </a>
              <a
                className="proof-chip"
                href="https://testnet.monadexplorer.com/tx/0xd465c6b769c300ab137e0bf4a9861905c26f4e611da92cb935e0338ab94f8323"
              >
                <span className="dot" />
                0xd465&hellip;8323 &#8599;
              </a>
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
              <CountUp value={0} />
            </div>
            <div className="lbl">mocked results: every transaction is a real Monad tx</div>
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
          <h2>One seatbelt, however you build</h2>
        </div>
        <p className="sec-sub">
          Use the app in one click, or drop the same pre-flight engine into your own dApp, agent,
          or deploy scripts.
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

      {/* CTA BAND */}
      <section className="cta-band" data-reveal>
        <div className="cta-band-inner">
          <div>
            <h2>Every send gets checked, live, before you sign.</h2>
            <p className="sec-sub" style={{ marginBottom: 20 }}>
              No calldata to paste, no setup. Connect a wallet and watch a doomed transaction get
              refused before it ever reaches you.
            </p>
            <Link className="btn btn-primary" href="/app">
              Try it on your wallet &rarr;
            </Link>
          </div>
          <div className="cta-band-visual">
            <HeroDiagram />
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
