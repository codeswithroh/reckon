"use client";
import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther, encodeFunctionData, type Address, type Hex } from "viem";
import { useConnection } from "wagmi";
import { monadTestnet, type RiskFlag } from "@codeswithroh/reckon-core";
import { scanWalletActivity, type WalletScanResult, type RiskyTx } from "../lib/walletScan";
import { narrateRiskFlag } from "../lib/narrate";
import type { WalletState } from "./WalletConnect";

const client = createPublicClient({ chain: monadTestnet, transport: http() });
const EXPLORER = "https://testnet.monadexplorer.com";
const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const trimMon = (wei: bigint) => {
  const n = Number(formatEther(wei));
  return n === 0 ? "0" : n < 0.0001 && n > 0 ? "<0.0001" : n.toPrecision(3).replace(/\.?0+$/, "");
};

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const NFT_SET_APPROVAL_ABI = [
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

/**
 * A `permit()` signature and an `approve()` call both land in the same ERC-20 allowance mapping,
 * so revoking either one is the same on-chain action: `approve(spender, 0)`, sent by the owner.
 */
function buildRevokeTx(flag: RiskFlag, token: Address): { to: Address; data: Hex } | null {
  const d = flag.details ?? {};
  switch (flag.kind) {
    case "erc20_approve":
    case "erc20_increase_allowance":
    case "eip2612_permit": {
      const spender = d.spender;
      if (typeof spender !== "string") return null;
      return {
        to: token,
        data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [spender as Address, 0n] }),
      };
    }
    case "nft_set_approval_for_all": {
      const operator = d.operator;
      if (typeof operator !== "string") return null;
      return {
        to: token,
        data: encodeFunctionData({
          abi: NFT_SET_APPROVAL_ABI,
          functionName: "setApprovalForAll",
          args: [operator as Address, false],
        }),
      };
    }
    default:
      return null;
  }
}

type RevokeState = { kind: "idle" } | { kind: "pending" } | { kind: "done"; hash: string } | { kind: "error"; message: string };

function RevokeButton({ flag, tx, from }: { flag: RiskFlag; tx: RiskyTx; from: Address }) {
  const { connector } = useConnection();
  const [state, setState] = useState<RevokeState>({ kind: "idle" });
  const revokeTx = tx.to ? buildRevokeTx(flag, tx.to) : null;
  if (!revokeTx) return null;

  async function revoke() {
    if (!connector || !revokeTx) return;
    setState({ kind: "pending" });
    try {
      const provider = (await connector.getProvider()) as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: revokeTx.to, data: revokeTx.data }],
      })) as string;
      setState({ kind: "done", hash });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Revoke failed." });
    }
  }

  if (state.kind === "done") {
    return (
      <a className="revoke-btn done" href={`${EXPLORER}/tx/${state.hash}`}>
        ✓ Revoked — view tx ↗
      </a>
    );
  }

  return (
    <div className="revoke-wrap">
      <button className="revoke-btn" onClick={revoke} disabled={state.kind === "pending"}>
        {state.kind === "pending" ? "Revoking…" : "Revoke this permission"}
      </button>
      {state.kind === "error" && <span className="revoke-error">{state.message}</span>}
    </div>
  );
}

function reportHeadline(result: WalletScanResult): { text: string; tone: "ok" | "warn" | "block" } {
  const hasCritical = result.riskyTxs.some((t) => t.flags.some((f) => f.severity === "critical"));
  if (hasCritical) {
    return {
      text: `This wallet has ${result.riskyTxs.length} outstanding approval${result.riskyTxs.length === 1 ? "" : "s"} that let another address move its tokens. If you don't recognize the spender below, revoke it.`,
      tone: "block",
    };
  }
  if (result.revertCount > 0) {
    return {
      text: `${result.revertCount} recent transaction${result.revertCount === 1 ? "" : "s"} failed and still charged the full declared gas limit, burning ${trimMon(result.totalBurnedWei)} MON for nothing. That's how Monad's gas model works: reverts don't refund.`,
      tone: "block",
    };
  }
  if (result.riskyTxs.length > 0) {
    return {
      text: `${result.riskyTxs.length} approval${result.riskyTxs.length === 1 ? "" : "s"} found in this window. Nothing critical, but worth a glance below.`,
      tone: "warn",
    };
  }
  if (result.txCount === 0) {
    return {
      text: "No transactions found for this address in the scanned window. Either it's new, or its activity is further back than this scan reaches.",
      tone: "ok",
    };
  }
  return {
    text: `Clean record: ${result.txCount} transaction${result.txCount === 1 ? "" : "s"} found, none reverted, no risky approvals granted.`,
    tone: "ok",
  };
}

export function WalletReport({ wallet }: { wallet: WalletState }) {
  const address = wallet.address;
  const { address: connectedAddress, isConnected } = useConnection();
  // Revoking sends a real tx `from` the scanned address — only offer it when the wallet actually
  // connected in this tab is that same address, not whatever address happens to be pasted/shown.
  const canRevoke = isConnected && !!connectedAddress && !!address && connectedAddress.toLowerCase() === address.toLowerCase();
  const [result, setResult] = useState<WalletScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    scanWalletActivity(client, address)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Scan failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) {
    return (
      <div className="report-empty">
        Connect a wallet or paste an address above to see a real safety report: recent failed
        transactions, MON burned, and any outstanding risky approvals, scanned live from Monad
        testnet.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="report-empty">
        <span className="spinner" />
        &nbsp;Scanning recent Monad testnet history for {address.slice(0, 6)}…{address.slice(-4)}…
      </div>
    );
  }

  if (error) {
    return <div className="report-empty" style={{ color: "var(--block)" }}>{error}</div>;
  }

  if (!result) return null;

  const headline = reportHeadline(result);

  return (
    <div>
      <p className={`narrative ${headline.tone}`}>{headline.text}</p>

      <div className="report-stats">
        <div className="report-stat">
          <div className="num">{result.txCount}</div>
          <div className="lbl">transactions found ({result.blocksScanned} blocks scanned)</div>
        </div>
        <div className="report-stat">
          <div className={`num ${result.revertCount > 0 ? "block" : "good"}`}>{result.revertCount}</div>
          <div className="lbl">reverted</div>
        </div>
        <div className="report-stat">
          <div className={`num ${result.totalBurnedWei > 0n ? "block" : "good"}`}>
            {trimMon(result.totalBurnedWei)} MON
          </div>
          <div className="lbl">burned on failed transactions</div>
        </div>
        <div className="report-stat">
          <div className={`num ${result.riskyTxs.length > 0 ? "warn" : "good"}`}>
            {result.riskyTxs.length}
          </div>
          <div className="lbl">approvals granted in this window</div>
        </div>
      </div>

      {result.revertedTxs.length > 0 && (
        <div className="report-section">
          <h4>Reverted transactions (full gas limit still charged)</h4>
          {result.revertedTxs.map((t) => (
            <div className="report-row" key={t.hash}>
              <a className="txlink" href={`${EXPLORER}/tx/${t.hash}`}>
                {shortHash(t.hash)} ↗
              </a>
              <span className="amt burn">{trimMon(t.burnedWei)} MON burned</span>
            </div>
          ))}
        </div>
      )}

      {result.riskyTxs.length > 0 && (
        <div className="report-section">
          <h4>Approvals granted (review if you don&apos;t recognize them)</h4>
          {result.riskyTxs.map((t) => (
            <div key={t.hash} className="report-row-flags">
              <a className="txlink" href={`${EXPLORER}/tx/${t.hash}`}>
                {shortHash(t.hash)} ↗
              </a>
              {t.flags.map((f, i) => (
                <div key={i} className={`risk-flag ${f.severity}`}>
                  <span className="risk-flag-sev">{f.severity.toUpperCase()}</span>
                  <span>
                    <span className="risk-flag-msg">{narrateRiskFlag(f)}</span>
                    <span className="risk-flag-technical">{f.message}</span>
                  </span>
                  {canRevoke && address && (
                    <RevokeButton flag={f} tx={t} from={address} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {result.timedOut && (
        <p className="blurb" style={{ marginTop: 10 }}>
          Scan hit its time limit and stopped early — results are from a partial window, not full
          history.
        </p>
      )}
    </div>
  );
}
