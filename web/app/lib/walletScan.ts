import type { Address, Hex, PublicClient } from "viem";
import { detectRiskFlags, type RiskFlag } from "@codeswithroh/reckon-core";

/**
 * Scans real recent Monad testnet history for a wallet address and reports:
 *   - how many of its transactions reverted, and the real MON burned on them (gasUsed from the
 *     receipt IS the charged limit on Monad, verified in research/gas-model/VERIFICATION.md)
 *   - which of its successful transactions granted an approval/permission risk (decoded via
 *     @codeswithroh/reckon-core's riskDetection), the exact thing a revert-only check would miss
 *
 * Same bounded-scan discipline as the adaptive-buffer engine: a hard wall-clock cap so this never
 * hangs regardless of how quiet or busy the chain is, always returning whatever it found so far.
 */

export interface RevertedTx {
  hash: Hex;
  to: Address | null;
  burnedWei: bigint;
}

export interface RiskyTx {
  hash: Hex;
  to: Address | null;
  flags: RiskFlag[];
}

export interface WalletScanResult {
  address: Address;
  blocksScanned: number;
  txCount: number;
  revertCount: number;
  totalBurnedWei: bigint;
  revertedTxs: RevertedTx[];
  riskyTxs: RiskyTx[];
  timedOut: boolean;
}

export interface WalletScanOptions {
  blockLookback?: number;
  maxDurationMs?: number;
  maxRiskDecodeCount?: number;
}

const DEFAULT_BLOCK_LOOKBACK = 3_000;
const DEFAULT_MAX_DURATION_MS = 12_000;
const DEFAULT_MAX_RISK_DECODE = 40;
const SCAN_CONCURRENCY = 40;

export async function scanWalletActivity(
  client: PublicClient,
  address: Address,
  opts: WalletScanOptions = {},
): Promise<WalletScanResult> {
  const blockLookback = opts.blockLookback ?? DEFAULT_BLOCK_LOOKBACK;
  const maxDurationMs = opts.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const maxRiskDecodeCount = opts.maxRiskDecodeCount ?? DEFAULT_MAX_RISK_DECODE;
  const addrLower = address.toLowerCase();

  const startedAt = Date.now();
  const latest = await client.getBlockNumber();
  const floor = latest > BigInt(blockLookback) ? latest - BigInt(blockLookback) : 0n;

  let txCount = 0;
  let revertCount = 0;
  let totalBurnedWei = 0n;
  const revertedTxs: RevertedTx[] = [];
  const riskyTxs: RiskyTx[] = [];
  let successfulSeen = 0;
  let blocksScanned = 0;
  let timedOut = false;

  let cursor = latest;
  while (cursor > floor) {
    if (Date.now() - startedAt >= maxDurationMs) {
      timedOut = true;
      break;
    }
    const batchBlocks: bigint[] = [];
    for (let i = 0n; i < BigInt(SCAN_CONCURRENCY) && cursor - i > floor; i++) {
      batchBlocks.push(cursor - i);
    }
    if (batchBlocks.length === 0) break;

    const batchReceipts = await Promise.all(
      batchBlocks.map(async (bn) => {
        try {
          const receipts = await client.request({
            method: "eth_getBlockReceipts",
            params: [`0x${bn.toString(16)}`],
          });
          return receipts ?? [];
        } catch {
          return [];
        }
      }),
    );
    blocksScanned += batchBlocks.length;

    for (const receipts of batchReceipts) {
      const mine = receipts.filter((r) => (r.from ?? "").toLowerCase() === addrLower);
      for (const r of mine) {
        txCount++;
        const gasUsed = BigInt(r.gasUsed);
        const price = BigInt(r.effectiveGasPrice ?? "0x0");
        const to = (r.to ?? null) as Address | null;

        if (r.status === "0x0") {
          revertCount++;
          const burned = gasUsed * price;
          totalBurnedWei += burned;
          revertedTxs.push({ hash: r.transactionHash, to, burnedWei: burned });
        } else if (successfulSeen < maxRiskDecodeCount) {
          successfulSeen++;
          try {
            const tx = await client.request({
              method: "eth_getTransactionByHash",
              params: [r.transactionHash],
            });
            const flags = detectRiskFlags({ to: to ?? undefined, data: tx?.input as Hex | undefined });
            if (flags.length > 0) {
              riskyTxs.push({ hash: r.transactionHash, to, flags });
            }
          } catch {
            // skip — a single tx fetch failing shouldn't abort the whole scan
          }
        }
      }
    }

    cursor -= BigInt(batchBlocks.length);
  }

  return {
    address,
    blocksScanned,
    txCount,
    revertCount,
    totalBurnedWei,
    revertedTxs,
    riskyTxs,
    timedOut,
  };
}
