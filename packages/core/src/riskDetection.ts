import { type Address, type Hex, decodeAbiParameters, size, slice, toFunctionSelector } from "viem";

/**
 * Approval-risk detection.
 *
 * The May 2026 agent-drain incident (~$175K lost) worked because an *approval* isn't a
 * *transfer*: it moves zero value itself, so naive value-based spend caps wave it through,
 * yet it grants a standing (often unlimited) right for a third party to move value later.
 * A prompt-injected agent can be tricked into signing an innocuous-looking call that is
 * actually `approve(attacker, MAX_UINT256)` or `setApprovalForAll(attacker, true)`.
 *
 * This module decodes the 4-byte selector of a tx's calldata and flags known
 * approval-granting patterns, independent of `tx.value` (which is 0 for all of them).
 *
 * Pure, self-contained, no RPC required for the core detection path.
 */

/** Severity ordering, low to high, used to pick the "worst" flag. */
const SEVERITY_RANK: Record<RiskFlag["severity"], number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export interface RiskFlag {
  kind: string;
  severity: "info" | "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

/** Canonical function signatures, used to derive real selectors via viem (not hardcoded guesses). */
const SIG_APPROVE = "approve(address,uint256)";
const SIG_INCREASE_ALLOWANCE = "increaseAllowance(address,uint256)";
const SIG_SET_APPROVAL_FOR_ALL = "setApprovalForAll(address,bool)";
const SIG_PERMIT = "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)";
const SIG_TRANSFER = "transfer(address,uint256)";

/** Selectors derived from the canonical signatures above — verify against known real values in tests. */
export const SELECTOR_APPROVE = toFunctionSelector(SIG_APPROVE);
export const SELECTOR_INCREASE_ALLOWANCE = toFunctionSelector(SIG_INCREASE_ALLOWANCE);
export const SELECTOR_SET_APPROVAL_FOR_ALL = toFunctionSelector(SIG_SET_APPROVAL_FOR_ALL);
export const SELECTOR_PERMIT = toFunctionSelector(SIG_PERMIT);
export const SELECTOR_TRANSFER = toFunctionSelector(SIG_TRANSFER);

/** `type(uint256).max` — the canonical "unlimited allowance" sentinel. */
const MAX_UINT256 = 2n ** 256n - 1n;

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function decodeSelector(data: Hex): Hex | undefined {
  if (size(data) < 4) return undefined;
  return slice(data, 0, 4).toLowerCase() as Hex;
}

/**
 * Decode calldata and flag known approval-granting / risky patterns.
 * Pure function: no network calls. Returns `[]` for ordinary calls (e.g. `transfer`).
 */
export function detectRiskFlags(tx: { to?: Address; data?: Hex; value?: bigint }): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (tx.value !== undefined && tx.value > 0n) {
    flags.push({
      kind: "native_value_transfer",
      severity: "info",
      message: `Transaction sends ${tx.value} wei of native value.`,
      details: { value: tx.value },
    });
  }

  const data = tx.data;
  if (!data || data === "0x") return flags;

  let selector: Hex | undefined;
  try {
    selector = decodeSelector(data);
  } catch {
    return flags;
  }
  if (!selector) return flags;

  try {
    switch (selector) {
      case SELECTOR_APPROVE: {
        const [spender, amount] = decodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          slice(data, 4),
        ) as [Address, bigint];
        const unlimited = amount === MAX_UINT256;
        flags.push({
          kind: "erc20_approve",
          severity: unlimited ? "critical" : "warning",
          message: unlimited
            ? `CRITICAL: grants unlimited ERC-20 allowance to ${shortAddr(spender)}`
            : `Grants ERC-20 allowance of ${amount} to ${shortAddr(spender)}`,
          details: { spender, amount, unlimited },
        });
        break;
      }
      case SELECTOR_INCREASE_ALLOWANCE: {
        const [spender, addedValue] = decodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          slice(data, 4),
        ) as [Address, bigint];
        const unlimited = addedValue === MAX_UINT256;
        flags.push({
          kind: "erc20_increase_allowance",
          severity: unlimited ? "critical" : "warning",
          message: unlimited
            ? `CRITICAL: increases ERC-20 allowance to unlimited for ${shortAddr(spender)}`
            : `Increases ERC-20 allowance by ${addedValue} for ${shortAddr(spender)}`,
          details: { spender, addedValue, unlimited },
        });
        break;
      }
      case SELECTOR_SET_APPROVAL_FOR_ALL: {
        const [operator, approved] = decodeAbiParameters(
          [{ type: "address" }, { type: "bool" }],
          slice(data, 4),
        ) as [Address, boolean];
        flags.push({
          kind: "nft_set_approval_for_all",
          severity: approved ? "critical" : "info",
          message: approved
            ? `CRITICAL: grants operator ${shortAddr(operator)} control over ALL your NFTs`
            : `Revokes operator ${shortAddr(operator)}'s approval over your NFTs`,
          details: { operator, approved },
        });
        break;
      }
      case SELECTOR_PERMIT: {
        const [owner, spender, value, deadline] = decodeAbiParameters(
          [
            { type: "address" },
            { type: "address" },
            { type: "uint256" },
            { type: "uint256" },
            { type: "uint8" },
            { type: "bytes32" },
            { type: "bytes32" },
          ],
          slice(data, 4),
        ) as [Address, Address, bigint, bigint, number, Hex, Hex];
        const unlimited = value === MAX_UINT256;
        flags.push({
          kind: "eip2612_permit",
          severity: "warning",
          message: `Gasless EIP-2612 permit grants ${shortAddr(spender)} allowance of ${value}${unlimited ? " (unlimited)" : ""} from ${shortAddr(owner)}`,
          details: { owner, spender, value, deadline, unlimited },
        });
        break;
      }
      default:
        break;
    }
  } catch {
    // Malformed calldata for a known selector (e.g. truncated args) — don't crash pre-flight,
    // just skip decoding; the selector-match itself already tells us nothing risky was confirmed.
  }

  return flags;
}

/**
 * One-line human-readable summary of the highest-severity flag, suitable for inclusion
 * in a pre-flight verdict's notes. Empty string when there are no flags.
 */
export function summarizeRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) return "";
  const worst = flags.reduce((acc, f) =>
    SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc.severity] ? f : acc,
  );
  const prefix = worst.severity.toUpperCase();
  const message = worst.message.startsWith(prefix) ? worst.message.slice(prefix.length + 2) : worst.message;
  return `${prefix}: ${message}`;
}
