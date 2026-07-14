import { PreflightWidget } from "./components/Preflight";
import { RevealController } from "./components/Reveal";
import demo from "./lib/demo-results.json";
import { GUARDED_EXECUTOR } from "./lib/presets";

const EXPLORER = "https://testnet.monadexplorer.com";
const MONADSCAN = "https://testnet.monadscan.com";

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6l-9-4Z"
        stroke="#836EF9"
        strokeWidth="1.6"
        fill="rgba(131,110,249,0.12)"
      />
      <path d="M8.5 12.2l2.6 2.6 4.6-5.1" stroke="#A996FF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export default function Page() {
  const s0 = demo.scenarios[0]!;
  const s1 = demo.scenarios[1]!;
  return (
    <div className="wrap">
      <RevealController />

      <nav className="nav">
        <div className="brand">
          <Mark />
          Reckon
        </div>
        <div className="nav-links">
          <a href="#try">Try it</a>
          <a href="#proof">Proof</a>
          <a href="#surfaces">Surfaces</a>
          <a href="https://github.com/codeswithroh/reckon">GitHub ↗</a>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <span className="eyebrow">Monad testnet · live</span>
        <h1>
          A transaction seatbelt
          <br />
          for <span className="accent">Monad</span>.
        </h1>
        <p className="tagline">// a screenshot can lie. a receipt can&apos;t.</p>
        <p className="subhead">
          On Monad you pay for the gas limit you declare — <strong>not</strong> the gas you use, and
          even when your transaction reverts. Reckon pre-flights every transaction: it simulates it,
          refuses to broadcast doomed ones, and sets the tightest correct gas limit.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href="#try">
            Try the live pre-flight
          </a>
          <a className="btn" href="https://github.com/codeswithroh/reckon">
            Read the code
          </a>
        </div>

        <div className="stats">
          <div className="stat" data-reveal>
            <div className="num good">{demo.reductionPct}%</div>
            <div className="lbl">less MON burned by a Reckon-guarded agent</div>
          </div>
          <div className="stat" data-reveal>
            <div className="num">100%</div>
            <div className="lbl">of failed txs charge the full gas limit on Monad</div>
          </div>
          <div className="stat" data-reveal>
            <div className="num accent">3</div>
            <div className="lbl">surfaces: SDK · MCP agent guard · on-chain</div>
          </div>
          <div className="stat" data-reveal>
            <div className="num">42</div>
            <div className="lbl">tests, all against live testnet + local EVM</div>
          </div>
        </div>
      </header>

      {/* TRY IT */}
      <section id="try">
        <div className="sec-head">
          <span className="sec-num">01</span>
          <h2>Pre-flight a transaction, live</h2>
        </div>
        <p className="sec-sub">
          Pick a scenario (or paste your own target + calldata). Reckon runs a real{" "}
          <span className="mono">eth_estimateGas</span> against Monad testnet and returns a verdict:
          send it or don&apos;t, at what gas limit, and what it would cost.
        </p>
        <PreflightWidget />
      </section>

      {/* PROOF */}
      <section id="proof">
        <div className="sec-head">
          <span className="sec-num">02</span>
          <h2>Naive agent vs. Reckon-guarded — on-chain</h2>
        </div>
        <p className="sec-sub">
          A real autonomous-agent run on testnet. Every number below is a real balance delta; every
          hash links to the Monad explorer.
        </p>
        <div className="cmp" data-reveal>
          <div className="cmp-row head">
            <div className="cmp-cell">Action</div>
            <div className="cmp-cell">Naive agent</div>
            <div className="cmp-cell">Reckon-guarded</div>
          </div>
          <div className="cmp-row">
            <div className="cmp-cell">
              {s0.scenario}
              <br />
              <span className="blurb">Reckon blocks it before broadcast.</span>
            </div>
            <div className="cmp-cell">
              <div className="amt burn">{Number(s0.naive.spentMON).toPrecision(3)} MON</div>
              <a className="txlink" href={`${EXPLORER}/tx/${s0.naive.tx}`}>
                {shortHash(s0.naive.tx)} ↗
              </a>
              <div className="blurb">reverted — burned anyway</div>
            </div>
            <div className="cmp-cell">
              <div className="amt save">0 MON</div>
              <div className="blurb">blocked pre-broadcast</div>
            </div>
          </div>
          <div className="cmp-row">
            <div className="cmp-cell">
              {s1.scenario}
              <br />
              <span className="blurb">Reckon right-sizes the gas limit.</span>
            </div>
            <div className="cmp-cell">
              <div className="amt burn">{Number(s1.naive.spentMON).toPrecision(3)} MON</div>
              <a className="txlink" href={`${EXPLORER}/tx/${s1.naive.tx}`}>
                {shortHash(s1.naive.tx)} ↗
              </a>
              <div className="blurb">200k-gas padded limit</div>
            </div>
            <div className="cmp-cell">
              <div className="amt save">{Number(s1.reckon.spentMON).toPrecision(3)} MON</div>
              <a className="txlink" href={`${EXPLORER}/tx/${s1.reckon.tx}`}>
                {shortHash(s1.reckon.tx!)} ↗
              </a>
              <div className="blurb">tight, safe limit</div>
            </div>
          </div>
          <div className="cmp-row">
            <div className="cmp-cell">
              <strong>Total</strong>
            </div>
            <div className="cmp-cell">
              <div className="amt burn">{Number(demo.naiveTotalMON).toPrecision(3)} MON</div>
              <div className="blurb">burned</div>
            </div>
            <div className="cmp-cell">
              <div className="amt save">{Number(demo.reckonTotalMON).toPrecision(3)} MON</div>
              <div className="blurb">spent — {demo.reductionPct}% less</div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTRACT */}
      <section>
        <div className="sec-head">
          <span className="sec-num">03</span>
          <h2>On-chain guard, deployed &amp; verified</h2>
        </div>
        <p className="sec-sub">
          <span className="mono">GuardedExecutor</span> — bounded, predictable batch execution with
          per-caller policy (value caps, gas-price ceiling, target allowlist). It can&apos;t refund
          gas (Monad charges the limit); its job is safe, tight, policy-checked execution.
        </p>
        <div className="contract" data-reveal>
          <div>
            <div className="verified">✓ source-verified on MonadVision &amp; Monadscan</div>
            <div className="addr" style={{ marginTop: 8 }}>
              {GUARDED_EXECUTOR}
            </div>
          </div>
          <div className="cta-row" style={{ marginTop: 0 }}>
            <a className="btn" href={`${MONADSCAN}/address/${GUARDED_EXECUTOR}`}>
              Monadscan ↗
            </a>
            <a className="btn" href={`${EXPLORER}/address/${GUARDED_EXECUTOR}`}>
              Explorer ↗
            </a>
          </div>
        </div>
      </section>

      {/* SURFACES */}
      <section id="surfaces">
        <div className="sec-head">
          <span className="sec-num">04</span>
          <h2>Three surfaces, one seatbelt</h2>
        </div>
        <p className="sec-sub">
          The same pre-flight engine, wherever transactions originate.
        </p>
        <div className="surfaces">
          <div className="card" data-reveal>
            <span className="tag">packages/sdk</span>
            <h3>Drop-in SDK</h3>
            <p>
              A viem wrapper: <span className="mono">preflight()</span>,{" "}
              <span className="mono">safeSend()</span>, and batch routing through the on-chain guard.
              Add the seatbelt to any dApp or deploy script.
            </p>
          </div>
          <div className="card" data-reveal>
            <span className="tag">packages/agent</span>
            <h3>MCP agent guard</h3>
            <p>
              An MCP server exposing <span className="mono">reckon_preflight</span> so any AI agent
              checks every transaction before sending. Agents fire the most txs — and are the most
              exposed.
            </p>
          </div>
          <div className="card" data-reveal>
            <span className="tag">contracts/</span>
            <h3>On-chain GuardedExecutor</h3>
            <p>
              Bounded, predictable execution with per-caller policy, enforced on-chain outside any
              agent&apos;s control. EIP-7702 friendly.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <span>Reckon · built on Monad testnet · MIT</span>
        <span className="mono">
          <a href="https://github.com/codeswithroh/reckon">github.com/codeswithroh/reckon</a>
        </span>
      </footer>
    </div>
  );
}
