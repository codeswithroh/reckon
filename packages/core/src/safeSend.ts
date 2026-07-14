import type { Account, Hash, PublicClient, WalletClient } from "viem";
import type { PreflightOptions, PreflightVerdict, ReckonTxRequest } from "./types.js";
import { preflight } from "./preflight.js";

export class ReckonRefusedError extends Error {
  readonly verdict: PreflightVerdict;
  constructor(verdict: PreflightVerdict) {
    super(
      `Reckon refused to broadcast: transaction would revert (${verdict.revertReason ?? "unknown"}). ` +
        `On Monad this would still charge the full gas limit.`,
    );
    this.name = "ReckonRefusedError";
    this.verdict = verdict;
  }
}

export interface SafeSendResult {
  hash: Hash;
  verdict: PreflightVerdict;
}

/**
 * Pre-flight, then broadcast only if safe — using the recommended tight gas limit.
 * Throws {@link ReckonRefusedError} (never broadcasts) when the tx would revert, so you never
 * pay a full-limit fee for a doomed transaction.
 */
export async function safeSend(
  clients: { publicClient: PublicClient; walletClient: WalletClient; account: Account },
  tx: ReckonTxRequest,
  options: PreflightOptions = {},
): Promise<SafeSendResult> {
  const verdict = await preflight(clients.publicClient, tx, options);
  if (!verdict.ok || verdict.recommendedGasLimit === undefined) {
    throw new ReckonRefusedError(verdict);
  }
  const hash = await clients.walletClient.sendTransaction({
    account: clients.account,
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gas: verdict.recommendedGasLimit,
    chain: clients.walletClient.chain,
  });
  return { hash, verdict };
}
