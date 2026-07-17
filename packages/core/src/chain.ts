import { defineChain } from "viem";

/**
 * Monad testnet (chainId 10143).
 *
 * Defined locally rather than imported so `@codeswithroh/reckon-core` has no hard dependency on a
 * particular viem version's chain list. RPC + explorer verified live during Phase 0.
 */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_CHAIN_ID = 10143;
