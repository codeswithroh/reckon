"use client";
import { useState } from "react";
import { Icon, type IconName } from "./Icon";

type TabId = "sdk" | "mcp" | "wallet" | "composable";

const TABS: Array<{ id: TabId; label: string; icon: IconName }> = [
  { id: "sdk", label: "SDK", icon: "terminal" },
  { id: "mcp", label: "MCP agent guard", icon: "bot" },
  { id: "wallet", label: "Wallet guard", icon: "wallet" },
  { id: "composable", label: "Composable signal", icon: "link-2" },
];

export function IntegrateTabs() {
  const [tab, setTab] = useState<TabId>("sdk");
  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {tab === "sdk" && (
        <div className="tab-panel">
          <p className="sec-sub">A drop-in wrapper for any dApp or deploy script.</p>
          <div className="code">
            <div>
              <span className="k">import</span> {"{ createReckonClient }"} <span className="k">from</span>{" "}
              <span className="s">&quot;@codeswithroh/reckon-sdk&quot;</span>;
            </div>
            <div>&nbsp;</div>
            <div>
              <span className="k">const</span> reckon = <span className="f">createReckonClient</span>();
            </div>
            <div>&nbsp;</div>
            <div>
              <span className="c">{"// check before you send"}</span>
            </div>
            <div>
              <span className="k">const</span> verdict = <span className="k">await</span> reckon.
              <span className="f">preflight</span>(tx);
            </div>
            <div>
              <span className="k">if</span> (verdict.willRevert) throw <span className="k">new</span>{" "}
              Error(verdict.revertReason);
            </div>
            <div>&nbsp;</div>
            <div>
              <span className="c">{"// or just send safely, tight gas limit included"}</span>
            </div>
            <div>
              <span className="k">const</span> {"{ hash }"} = <span className="k">await</span> reckon.
              <span className="f">safeSend</span>(tx);
            </div>
          </div>
        </div>
      )}

      {tab === "mcp" && (
        <div className="tab-panel">
          <p className="sec-sub">Lets any AI agent pre-flight every send before it happens.</p>
          <div className="code">
            <div>
              <span className="c">{"// mcp host config (e.g. Claude Code / Claude Desktop)"}</span>
            </div>
            <div>{"{"}</div>
            <div>&nbsp;&nbsp;<span className="s">&quot;mcpServers&quot;</span>: {"{"}</div>
            <div>
              &nbsp;&nbsp;&nbsp;&nbsp;<span className="s">&quot;reckon&quot;</span>: {"{"}
            </div>
            <div>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="s">&quot;command&quot;</span>:{" "}
              <span className="s">&quot;node&quot;</span>,
            </div>
            <div>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="s">&quot;args&quot;</span>: [
              <span className="s">&quot;packages/agent/dist/server.js&quot;</span>]
            </div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;{"}"}</div>
            <div>&nbsp;&nbsp;{"}"}</div>
            <div>{"}"}</div>
            <div>&nbsp;</div>
            <div>
              <span className="c">{"// tools exposed: reckon_preflight, reckon_quote_cost"}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="tab-panel">
          <p className="sec-sub">Wrap any wallet. Doomed sends never reach it.</p>
          <div className="code">
            <div>
              <span className="c">{"// wrap the injected wallet. done."}</span>
            </div>
            <div>
              <span className="k">import</span> {"{ createGuardedProvider }"}{" "}
              <span className="k">from</span> <span className="s">&quot;@codeswithroh/reckon-sdk&quot;</span>;
            </div>
            <div>&nbsp;</div>
            <div>
              <span className="k">const</span> provider = <span className="f">createGuardedProvider</span>
              (window.ethereum);
            </div>
            <div>
              <span className="c">{"// a tx that would revert now throws before the wallet opens."}</span>
            </div>
            <div>
              <span className="c">{"// the user never signs it, and never burns MON on a failure."}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "composable" && (
        <div className="tab-panel">
          <p className="sec-sub">A pure function any system can call directly, no network round-trip.</p>
          <div className="code">
            <div>
              <span className="k">import</span> {"{ detectRiskFlags }"} <span className="k">from</span>{" "}
              <span className="s">&quot;@codeswithroh/reckon-core&quot;</span>;
            </div>
            <div>&nbsp;</div>
            <div>
              <span className="c">{"// zero RPC calls, safe to run in a hot path, an agent loop, or a relayer"}</span>
            </div>
            <div>
              <span className="k">const</span> flags = <span className="f">detectRiskFlags</span>({"{ to, data, value }"});
            </div>
            <div>
              <span className="k">if</span> (flags.some(f =&gt; f.severity === <span className="s">&quot;critical&quot;</span>)) {"{"}
            </div>
            <div>
              &nbsp;&nbsp;<span className="c">{"// stop here: don't forward, don't co-sign, don't relay"}</span>
            </div>
            <div>{"}"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
