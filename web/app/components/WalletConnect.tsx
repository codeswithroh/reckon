"use client";
import { useEffect, useState } from "react";
import { isAddress } from "viem";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

export interface WalletState {
  address: `0x${string}` | null;
  /** True only when the address came from a real connected injected wallet, not pasted manually. */
  isRealWallet: boolean;
}

export function WalletConnect({
  onChange,
}: {
  onChange: (state: WalletState) => void;
}) {
  const [hasInjected, setHasInjected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<`0x${string}` | null>(null);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasInjected(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  async function connect() {
    if (!window.ethereum) return;
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const addr = accounts?.[0];
      if (addr && isAddress(addr)) {
        setConnectedAddress(addr as `0x${string}`);
        onChange({ address: addr as `0x${string}`, isRealWallet: true });
      } else {
        setError("No account returned by wallet.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection rejected.");
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setConnectedAddress(null);
    onChange({ address: null, isRealWallet: false });
  }

  function usePasted() {
    setError(null);
    if (!isAddress(pasted)) {
      setError("Not a valid address.");
      return;
    }
    onChange({ address: pasted as `0x${string}`, isRealWallet: false });
  }

  if (connectedAddress) {
    return (
      <div className="wallet-bar connected">
        <span className="wallet-dot" />
        <span className="mono wallet-addr">
          {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
        </span>
        <span className="wallet-tag">connected wallet</span>
        <button className="btn btn-sm" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-bar">
      {hasInjected ? (
        <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      ) : (
        <span className="blurb">No injected wallet detected.</span>
      )}
      <span className="wallet-or">or paste an address</span>
      <input
        className="wallet-paste"
        placeholder="0x..."
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        spellCheck={false}
      />
      <button className="btn btn-sm" onClick={usePasted}>
        Use address
      </button>
      {error && <span className="wallet-error">{error}</span>}
    </div>
  );
}
