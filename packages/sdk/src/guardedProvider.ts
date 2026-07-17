import {
  createPublicClient,
  http,
  numberToHex,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { monadTestnet, preflight, ReckonRefusedError, type PreflightVerdict } from "@codeswithroh/reckon-core";

/** Minimal EIP-1193 provider shape (what wallets and injected `window.ethereum` expose). */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface GuardOptions {
  /** `block` (default) throws on a doomed tx so the wallet never prompts; `warn` only reports. */
  mode?: "block" | "warn";
  /** RPC used for the pre-flight simulation. Defaults to Monad testnet. */
  rpcUrl?: string;
  /** Inject the recommended tight gas limit on healthy sends. Default true. */
  injectGas?: boolean;
  /** Called with the verdict for every intercepted `eth_sendTransaction`. */
  onVerdict?: (verdict: PreflightVerdict, tx: Record<string, unknown>) => void;
}

interface RawTx {
  from?: Address;
  to?: Address;
  data?: Hex;
  value?: Hex | bigint | number;
  gas?: Hex | bigint | number;
}

function toBigInt(v: Hex | bigint | number | undefined): bigint | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  return BigInt(v);
}

/**
 * Wrap an EIP-1193 provider with Reckon's seatbelt. Every `eth_sendTransaction` is pre-flighted
 * against Monad first: doomed transactions are blocked (or flagged) before the wallet prompts the
 * user, and healthy ones get the tightest correct gas limit. All other RPC calls pass through
 * untouched. One line to protect a whole dApp's users.
 *
 * @example
 * const provider = createGuardedProvider(window.ethereum);
 */
export function createGuardedProvider(
  inner: Eip1193Provider,
  opts: GuardOptions = {},
): Eip1193Provider {
  const mode = opts.mode ?? "block";
  const injectGas = opts.injectGas ?? true;
  const client: PublicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(opts.rpcUrl),
  });

  return {
    async request(args) {
      if (args.method !== "eth_sendTransaction" || !args.params?.length) {
        return inner.request(args);
      }
      const tx = { ...(args.params[0] as RawTx) } as RawTx;
      let from = tx.from;
      if (!from) {
        const accounts = (await inner.request({ method: "eth_accounts" })) as Address[];
        from = accounts?.[0];
      }
      if (!from) return inner.request(args); // can't pre-flight without a sender

      const verdict = await preflight(client, {
        from,
        to: tx.to,
        data: tx.data,
        value: toBigInt(tx.value),
      });
      opts.onVerdict?.(verdict, tx as Record<string, unknown>);

      if (verdict.willRevert) {
        if (mode === "block") throw new ReckonRefusedError(verdict);
        // warn mode: fall through and let the user decide
      } else if (injectGas && verdict.recommendedGasLimit !== undefined) {
        tx.gas = numberToHex(verdict.recommendedGasLimit);
      }

      return inner.request({ ...args, params: [tx, ...args.params.slice(1)] });
    },
  };
}
