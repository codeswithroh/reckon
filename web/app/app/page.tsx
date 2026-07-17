import type { Metadata } from "next";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { RevealController } from "../components/Reveal";
import { DashboardApp } from "../components/DashboardApp";
import { GUARDED_EXECUTOR } from "../lib/presets";

export const metadata: Metadata = {
  title: "Dashboard: Reckon",
  description: "Check your Monad wallet's real safety history, live, and try Reckon's guard yourself.",
};

const MONADSCAN = "https://testnet.monadscan.com";
const EXPLORER = "https://testnet.monadexplorer.com";

export default function DashboardPage() {
  return (
    <div className="wrap">
      <RevealController />
      <Header variant="app" />

      <div className="app-shell-banner">
        <h1>Your Monad safety dashboard</h1>
        <p>
          Not a sandbox: connect your wallet and Reckon actually guards it, live, in this
          browser, in whatever dApp you go use next. See its real history, revoke what you find,
          and check it all before you sign, not after.
        </p>
      </div>

      <DashboardApp />

      <section>
        <div className="sec-head">
          <span className="sec-num">&#9670;</span>
          <h2>On-chain guard, deployed &amp; verified</h2>
        </div>
        <p className="sec-sub">
          <span className="mono">GuardedExecutor</span>: bounded, predictable batch execution with
          per-caller policy (value caps, gas-price ceiling, target allowlist). It can&apos;t refund
          gas (Monad charges the limit); its job is safe, tight, policy-checked execution.
        </p>
        <div className="contract" data-reveal>
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
      </section>

      <Footer />
    </div>
  );
}
