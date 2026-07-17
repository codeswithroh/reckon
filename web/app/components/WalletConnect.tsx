"use client";
import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";

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
  const connectors = useConnectors();
  const { connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { address: connectedAddress, isConnected } = useConnection();

  const [pasted, setPasted] = useState("");
  const [pastedAddress, setPastedAddress] = useState<`0x${string}` | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // A manually pasted address takes priority for "what to inspect" until cleared, even if a real
  // wallet is also connected — this mirrors the previous behaviour (paste always overrides).
  useEffect(() => {
    if (pastedAddress) {
      onChange({ address: pastedAddress, isRealWallet: false });
    } else if (isConnected && connectedAddress) {
      onChange({ address: connectedAddress, isRealWallet: true });
    } else {
      onChange({ address: null, isRealWallet: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastedAddress, isConnected, connectedAddress]);

  function disconnectWallet() {
    disconnect();
    setPastedAddress(null);
  }

  function usePasted() {
    setPasteError(null);
    if (!isAddress(pasted)) {
      setPasteError("Not a valid address.");
      return;
    }
    setPastedAddress(pasted as `0x${string}`);
  }

  if (isConnected && connectedAddress && !pastedAddress) {
    return (
      <div className="wallet-bar connected">
        <span className="wallet-dot" />
        <span className="mono wallet-addr">
          {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
        </span>
        <span className="wallet-tag">connected wallet</span>
        <button className="btn btn-sm" onClick={disconnectWallet}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-bar">
      {connectors.length > 0 ? (
        <div className="wallet-connectors">
          {connectors.map((c) => (
            <button
              key={c.uid}
              className="btn btn-primary btn-sm"
              onClick={() => connect({ connector: c })}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : `Connect ${c.name}`}
            </button>
          ))}
        </div>
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
      {(pasteError || connectError) && (
        <span className="wallet-error">{pasteError ?? connectError?.message}</span>
      )}
    </div>
  );
}
