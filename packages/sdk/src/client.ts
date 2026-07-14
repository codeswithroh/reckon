import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  formatEther,
  type Account,
  type Hash,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import {
  monadTestnet,
  preflight,
  safeSend,
  type PreflightOptions,
  type PreflightVerdict,
  type ReckonTxRequest,
  type SafeSendResult,
} from "@reckon/core";
import { guardedExecutorAbi, GUARDED_EXECUTOR_TESTNET } from "./abi.js";

export interface ReckonClientConfig {
  /** RPC URL. Defaults to Monad testnet public RPC. */
  rpcUrl?: string;
  /** Optional signer for `safeSend` / `guardedExecute`. Read-only methods work without it. */
  account?: Account;
  /** Override the GuardedExecutor address (defaults to the testnet deployment). */
  guardedExecutor?: `0x${string}`;
}

export interface GuardedCall {
  target: `0x${string}`;
  value?: bigint;
  data?: Hex;
  /** Per-call forwarded gas cap. Defaults to a bounded value so the batch limit stays tight. */
  gasCap?: bigint;
}

/**
 * A Reckon client: pre-flight and safe-send Monad transactions, or route a batch through the
 * on-chain GuardedExecutor. Read-only methods need no signer.
 */
export class ReckonClient {
  readonly publicClient: PublicClient;
  readonly walletClient?: WalletClient;
  readonly account?: Account;
  readonly guardedExecutor: `0x${string}`;

  constructor(config: ReckonClientConfig = {}) {
    const transport: Transport = http(config.rpcUrl);
    this.publicClient = createPublicClient({ chain: monadTestnet, transport });
    this.account = config.account;
    if (config.account) {
      this.walletClient = createWalletClient({
        chain: monadTestnet,
        transport,
        account: config.account,
      });
    }
    this.guardedExecutor = config.guardedExecutor ?? GUARDED_EXECUTOR_TESTNET;
  }

  /** Pre-flight a transaction: revert check, tight gas limit, worst-case cost, savings. */
  preflight(tx: ReckonTxRequest, options?: PreflightOptions): Promise<PreflightVerdict> {
    return preflight(this.publicClient, tx, options);
  }

  /** Worst-case MON this tx will be charged, plus whether it would revert. */
  async quoteCost(
    tx: ReckonTxRequest,
    options?: PreflightOptions,
  ): Promise<{ willRevert: boolean; worstCaseMON?: string; recommendedGasLimit?: bigint }> {
    const v = await this.preflight(tx, options);
    return {
      willRevert: v.willRevert,
      worstCaseMON: v.worstCaseFeeMON,
      recommendedGasLimit: v.recommendedGasLimit,
    };
  }

  /** Pre-flight then broadcast only if safe, using the recommended tight limit. */
  safeSend(tx: ReckonTxRequest, options?: PreflightOptions): Promise<SafeSendResult> {
    this.requireSigner();
    return safeSend(
      { publicClient: this.publicClient, walletClient: this.walletClient!, account: this.account! },
      tx,
      options,
    );
  }

  /**
   * Route a batch of calls through the on-chain GuardedExecutor.
   * Each call gets a per-call gas cap; the whole batch is pre-flighted and sent with a tight limit.
   */
  async guardedExecute(
    calls: GuardedCall[],
    opts: { atomic?: boolean } & PreflightOptions = {},
  ): Promise<SafeSendResult> {
    this.requireSigner();
    const atomic = opts.atomic ?? true;
    const totalValue = calls.reduce((s, c) => s + (c.value ?? 0n), 0n);
    const structs = calls.map((c) => ({
      target: c.target,
      value: c.value ?? 0n,
      data: c.data ?? ("0x" as Hex),
      gasCap: c.gasCap ?? 0n,
    }));
    const data = encodeFunctionData({
      abi: guardedExecutorAbi,
      functionName: "execute",
      args: [structs, atomic],
    });
    return this.safeSend(
      { from: this.account!.address, to: this.guardedExecutor, data, value: totalValue },
      opts,
    );
  }

  private requireSigner(): void {
    if (!this.walletClient || !this.account) {
      throw new Error("ReckonClient: an `account` is required for this operation.");
    }
  }
}

export function createReckonClient(config?: ReckonClientConfig): ReckonClient {
  return new ReckonClient(config);
}

export { formatEther, type Hash };
