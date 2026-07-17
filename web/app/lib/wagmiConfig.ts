import { createConfig, http, injected } from "wagmi";
import { monadTestnet } from "@codeswithroh/reckon-core";

/**
 * `injected()` with no `target` turns on EIP-6963 multi-provider discovery: every installed
 * wallet extension announces itself independently instead of all of them racing to stomp on a
 * single global `window.ethereum`. That race (last extension to inject wins, or whichever
 * extension's inject script runs first) is what made the old hand-rolled `window.ethereum.request`
 * connect flow flaky. `useConnectors()` surfaces each announced wallet as its own connector so the
 * user picks the exact one they want, and `connect()` talks to that specific provider.
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
