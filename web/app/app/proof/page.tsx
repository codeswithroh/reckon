import type { Metadata } from "next";
import { BarChart } from "../../components/BarChart";
import demo from "../../lib/demo-results.json";

export const metadata: Metadata = {
  title: "Proof: Reckon",
  description: "Real on-chain evidence: a naive agent vs a Reckon-guarded agent on Monad testnet.",
};

const EXPLORER = "https://testnet.monadexplorer.com";
const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export default function ProofPage() {
  const s0 = demo.scenarios[0]!;
  const s1 = demo.scenarios[1]!;
  return (
    <>
      <section style={{ paddingTop: 0 }}>
        <div className="section-visual" data-reveal>
          <BarChart
            data={[
              { label: "Naive agent", value: Number(demo.naiveTotalMON), colorVar: "var(--block)" },
              { label: "Reckon-guarded", value: Number(demo.reckonTotalMON), colorVar: "var(--ok)" },
            ]}
          />
        </div>
      </section>

      <section>
        <div className="sec-head">
          <span className="sec-num">&#9670;</span>
          <h2>Transaction-by-transaction</h2>
        </div>
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
                {shortHash(s0.naive.tx)} &#8599;
              </a>
              <div className="blurb">reverted, burned anyway</div>
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
                {shortHash(s1.naive.tx)} &#8599;
              </a>
              <div className="blurb">200k-gas padded limit</div>
            </div>
            <div className="cmp-cell">
              <div className="amt save">{Number(s1.reckon.spentMON).toPrecision(3)} MON</div>
              <a className="txlink" href={`${EXPLORER}/tx/${s1.reckon.tx}`}>
                {shortHash(s1.reckon.tx!)} &#8599;
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
              <div className="blurb">spent, {demo.reductionPct}% less</div>
            </div>
          </div>
        </div>
        <p className="sec-sub" style={{ marginTop: 16 }}>
          Reproduce this yourself:{" "}
          <span className="mono">packages/agent/demo/live-agent.mjs</span> in the{" "}
          <a href="https://github.com/codeswithroh/reckon">repo</a>.
        </p>
      </section>
    </>
  );
}
