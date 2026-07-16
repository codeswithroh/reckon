import { describe, it, expect } from "vitest";
import { encodeFunctionData, toFunctionSelector, type Address } from "viem";
import {
  detectRiskFlags,
  summarizeRiskFlags,
  SELECTOR_APPROVE,
  SELECTOR_INCREASE_ALLOWANCE,
  SELECTOR_SET_APPROVAL_FOR_ALL,
  SELECTOR_PERMIT,
  SELECTOR_TRANSFER,
  type RiskFlag,
} from "../../src/riskDetection.js";

const SPENDER: Address = "0x1111111111111111111111111111111111111111";
const OWNER: Address = "0x2222222222222222222222222222222222222222";
const OPERATOR: Address = "0x3333333333333333333333333333333333333333";
const TO: Address = "0x4444444444444444444444444444444444444444";

const MAX_UINT256 = 2n ** 256n - 1n;

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "increaseAllowance",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "addedValue", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const nftAbi = [
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }],
    outputs: [],
  },
] as const;

const permitAbi = [
  {
    type: "function",
    name: "permit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

describe("selector correctness", () => {
  it("matches known real-world selector values", () => {
    // Well-known, independently-verifiable selector values.
    expect(SELECTOR_APPROVE).toBe("0x095ea7b3");
    expect(SELECTOR_TRANSFER).toBe("0xa9059cbb");
    expect(SELECTOR_SET_APPROVAL_FOR_ALL).toBe("0xa22cb465");
    expect(SELECTOR_PERMIT).toBe("0xd505accf");
  });

  it("matches viem's own derivation for each canonical signature", () => {
    expect(SELECTOR_APPROVE).toBe(toFunctionSelector("approve(address,uint256)"));
    expect(SELECTOR_INCREASE_ALLOWANCE).toBe(
      toFunctionSelector("increaseAllowance(address,uint256)"),
    );
    expect(SELECTOR_SET_APPROVAL_FOR_ALL).toBe(
      toFunctionSelector("setApprovalForAll(address,bool)"),
    );
    expect(SELECTOR_PERMIT).toBe(
      toFunctionSelector("permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"),
    );
    expect(SELECTOR_TRANSFER).toBe(toFunctionSelector("transfer(address,uint256)"));
  });
});

describe("detectRiskFlags — approve", () => {
  it("flags a normal bounded approve as warning", () => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [SPENDER, 1_000n],
    });
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe("erc20_approve");
    expect(flags[0]?.severity).toBe("warning");
    expect(flags[0]?.details?.spender).toBe(SPENDER);
    expect(flags[0]?.details?.amount).toBe(1_000n);
  });

  it("flags an unlimited approve (MAX_UINT256) as critical", () => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [SPENDER, MAX_UINT256],
    });
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.severity).toBe("critical");
    expect(flags[0]?.details?.unlimited).toBe(true);
    expect(flags[0]?.message).toMatch(/unlimited/i);
  });
});

describe("detectRiskFlags — increaseAllowance", () => {
  it("flags increaseAllowance as warning", () => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "increaseAllowance",
      args: [SPENDER, 500n],
    });
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe("erc20_increase_allowance");
    expect(flags[0]?.severity).toBe("warning");
  });
});

describe("detectRiskFlags — setApprovalForAll", () => {
  it("flags granting (approved=true) as critical", () => {
    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: "setApprovalForAll",
      args: [OPERATOR, true],
    });
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe("nft_set_approval_for_all");
    expect(flags[0]?.severity).toBe("critical");
    expect(flags[0]?.details?.operator).toBe(OPERATOR);
  });

  it("does NOT flag revoking (approved=false) as critical", () => {
    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: "setApprovalForAll",
      args: [OPERATOR, false],
    });
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.severity).not.toBe("critical");
    expect(flags[0]?.severity).toBe("info");
  });
});

describe("detectRiskFlags — permit (EIP-2612)", () => {
  it("flags permit as warning", () => {
    const data = encodeFunctionData({
      abi: permitAbi,
      functionName: "permit",
      args: [
        OWNER,
        SPENDER,
        1_000n,
        9_999_999_999n,
        27,
        `0x${"11".repeat(32)}`,
        `0x${"22".repeat(32)}`,
      ],
    });
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe("eip2612_permit");
    expect(flags[0]?.severity).toBe("warning");
    expect(flags[0]?.details?.spender).toBe(SPENDER);
  });
});

describe("detectRiskFlags — no false positives", () => {
  it("does not flag a plain ERC-20 transfer", () => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [TO, 42n],
    });
    expect(data.slice(0, 10)).toBe(SELECTOR_TRANSFER);
    const flags = detectRiskFlags({ to: TO, data });
    expect(flags).toEqual([]);
  });

  it("does not flag or crash on a native transfer with no calldata", () => {
    expect(detectRiskFlags({ to: TO, data: "0x", value: 0n })).toEqual([]);
    expect(detectRiskFlags({ to: TO, value: 0n })).toEqual([]);
    expect(detectRiskFlags({ to: TO })).toEqual([]);
  });

  it("surfaces nonzero native value as info only, not risky", () => {
    const flags = detectRiskFlags({ to: TO, value: 123n });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe("native_value_transfer");
    expect(flags[0]?.severity).toBe("info");
  });
});

describe("summarizeRiskFlags", () => {
  it("returns empty string for no flags", () => {
    expect(summarizeRiskFlags([])).toBe("");
  });

  it("picks the highest-severity flag's message when multiple flags exist", () => {
    const flags: RiskFlag[] = [
      { kind: "a", severity: "info", message: "just info" },
      { kind: "b", severity: "warning", message: "a warning here" },
      {
        kind: "c",
        severity: "critical",
        message: "CRITICAL: grants unlimited ERC-20 allowance to 0x1234...5678",
      },
    ];
    const summary = summarizeRiskFlags(flags);
    expect(summary).toBe("CRITICAL: grants unlimited ERC-20 allowance to 0x1234...5678");
  });

  it("prefixes severity when the message doesn't already carry it", () => {
    const flags: RiskFlag[] = [{ kind: "a", severity: "warning", message: "some approval thing" }];
    expect(summarizeRiskFlags(flags)).toBe("WARNING: some approval thing");
  });
});
