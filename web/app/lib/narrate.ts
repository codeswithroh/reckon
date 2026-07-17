import type { PreflightResult, RiskFlagView } from "./preflightClient";

/**
 * Plain-English narration of a pre-flight verdict and its risk flags.
 *
 * The single most consistent pattern across real winning transaction-safety products
 * (FireMask, Safenode, Prank Wallet) is translating raw technical output into a genuine
 * sentence a non-technical person understands, shown BEFORE the technical numbers, not instead
 * of them. "Recommended gas limit: 57002" and "kind: erc20_approve, severity: critical" are
 * correct, but they don't communicate stakes. This module exists to close that gap.
 */

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

function fmtAmount(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number") return "some amount of";
  const s = String(v);
  // MAX_UINT256 already handled by `unlimited` flag upstream; this is for bounded amounts.
  if (s.length > 12) return "a very large amount of";
  return s;
}

export function narrateRiskFlag(flag: RiskFlagView): string {
  const d = flag.details ?? {};
  switch (flag.kind) {
    case "erc20_approve":
    case "erc20_increase_allowance": {
      const spender = typeof d.spender === "string" ? short(d.spender) : "an unknown address";
      const unlimited = d.unlimited === true;
      if (unlimited) {
        return `This gives ${spender} permission to take an unlimited amount of this token from you, at any time, forever, until you revoke it.`;
      }
      const amt = fmtAmount(d.amount ?? d.addedValue);
      return `This gives ${spender} permission to take up to ${amt} this token from you, whenever they choose, until you revoke it.`;
    }
    case "nft_set_approval_for_all": {
      const operator = typeof d.operator === "string" ? short(d.operator) : "an unknown address";
      return `This gives ${operator} full control over every NFT in this collection you own, now and in the future, until you revoke it.`;
    }
    case "eip2612_permit": {
      const spender = typeof d.spender === "string" ? short(d.spender) : "an unknown address";
      return `This is a gasless signature granting ${spender} a real spending allowance, the same permission as an on-chain approval, just authorized off-chain.`;
    }
    case "native_value_transfer":
      return "This sends MON directly. Once it's mined, it cannot be reversed.";
    default:
      return flag.message;
  }
}

const trimMon = (v: string | null) => {
  if (!v) return "n/a";
  const n = Number(v);
  return n === 0 ? "0" : n.toPrecision(4).replace(/\.?0+$/, "");
};

/**
 * The headline sentence for a verdict: what will actually happen if you sign this, in one or
 * two sentences, before any raw numbers.
 */
export function narrateVerdict(v: PreflightResult): string {
  if (v.willRevert) {
    const reason = v.revertReason ? ` The chain says why: ${v.revertReason}.` : "";
    return `This transaction would fail if you sent it.${reason} On Monad, a failed transaction still charges the full gas limit, so Reckon is stopping it before you pay for nothing.`;
  }

  if (v.hasCriticalRisk) {
    const critical = v.riskFlags.find((f) => f.severity === "critical");
    const detail = critical ? narrateRiskFlag(critical) : "It grants a risky, standing permission.";
    return `This transaction would succeed if you sent it, and that's exactly the danger. ${detail} Reckon is stopping you here so a human decides, not an automated signature.`;
  }

  const cost = trimMon(v.worstCaseFeeMON);
  const savings = v.savingsVsNaiveMON && Number(v.savingsVsNaiveMON) > 0 ? trimMon(v.savingsVsNaiveMON) : null;
  const savingsNote = savings ? ` Reckon also tightened your gas limit, saving about ${savings} MON versus a naive wallet default.` : "";
  return `This transaction is safe to send. It will cost about ${cost} MON at the current gas price.${savingsNote}`;
}
