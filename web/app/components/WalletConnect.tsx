"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isAddress } from "viem";
import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { Icon } from "./Icon";

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
  // wagmi's Register typing narrows useConnectors() to the static config's tuple length; the
  // real runtime list is dynamic (EIP-6963 discovery adds more), so widen back to a plain array.
  const connectors = Array.from(useConnectors());
  const { connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { address: connectedAddress, isConnected } = useConnection();

  const [modalOpen, setModalOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
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

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // Connecting closes the modal automatically, whether it succeeded or the user cancelled in
  // their wallet, no separate "did it work" check needed here.
  useEffect(() => {
    if (isConnected) setModalOpen(false);
  }, [isConnected]);

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
      <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
        Connect wallet
      </button>
      <button className="wallet-paste-toggle" onClick={() => setPasteOpen((v) => !v)} type="button">
        or paste an address
      </button>
      {connectError && <span className="wallet-error">{connectError.message}</span>}

      {pasteOpen && (
        <div className="wallet-paste-row">
          <input
            className="wallet-paste"
            placeholder="0x..."
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            spellCheck={false}
            autoFocus
          />
          <button className="btn btn-sm" onClick={usePasted}>
            Use address
          </button>
          {pasteError && <span className="wallet-error">{pasteError}</span>}
        </div>
      )}

      {modalOpen &&
        createPortal(
          // Portaled straight to <body>: rendering this inside the panel tree would nest it under
          // a [data-reveal] ancestor GSAP applies an inline transform to, which creates a new
          // containing block and breaks position:fixed centering (the modal ends up anchored near
          // the button instead of centered on the real viewport). Portaling escapes that entirely.
          <div className="wallet-modal-backdrop" onClick={() => setModalOpen(false)}>
            <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
              <div className="wallet-modal-head">
                <span>Connect a wallet</span>
                <button className="wallet-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="wallet-modal-list">
                {connectors.length === 0 && (
                  <p className="blurb" style={{ padding: "4px 2px" }}>
                    No wallet extension detected in this browser.
                  </p>
                )}
                {connectors.map((c) => (
                  <button
                    key={c.uid}
                    className="wallet-modal-item"
                    onClick={() => connect({ connector: c })}
                    disabled={connecting}
                  >
                    {c.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.icon} alt="" className="wallet-modal-icon" />
                    ) : (
                      <span className="wallet-modal-icon wallet-modal-icon-fallback">
                        <Icon name="wallet" size={16} />
                      </span>
                    )}
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
