import {
  type Hex,
  decodeErrorResult,
  slice,
  size,
  BaseError,
} from "viem";

/** Standard Solidity `Error(string)` selector. */
const ERROR_STRING_SELECTOR = "0x08c379a0";
/** Standard Solidity `Panic(uint256)` selector. */
const PANIC_SELECTOR = "0x4e487b71";

const PANIC_REASONS: Record<number, string> = {
  0x01: "assert(false)",
  0x11: "arithmetic overflow/underflow",
  0x12: "division or modulo by zero",
  0x21: "invalid enum value",
  0x22: "invalid storage byte array access",
  0x31: "pop() on empty array",
  0x32: "array index out of bounds",
  0x41: "out of memory / too much allocation",
  0x51: "call to invalid internal function",
};

/**
 * Decode raw revert data into a human-readable reason.
 * Handles `Error(string)`, `Panic(uint256)`, and bare 4-byte custom-error selectors.
 * Returns `undefined` for empty/undecodable data.
 */
export function decodeRevertReason(data: Hex | undefined): string | undefined {
  if (!data || data === "0x") return undefined;
  try {
    if (size(data) < 4) return `revert (raw: ${data})`;
    const selector = slice(data, 0, 4).toLowerCase();

    if (selector === ERROR_STRING_SELECTOR) {
      const decoded = decodeErrorResult({
        abi: [
          {
            type: "error",
            name: "Error",
            inputs: [{ type: "string", name: "reason" }],
          },
        ],
        data,
      });
      return String(decoded.args?.[0] ?? "revert");
    }

    if (selector === PANIC_SELECTOR) {
      const decoded = decodeErrorResult({
        abi: [
          {
            type: "error",
            name: "Panic",
            inputs: [{ type: "uint256", name: "code" }],
          },
        ],
        data,
      });
      const code = Number(decoded.args?.[0] ?? 0n);
      const label = PANIC_REASONS[code] ?? `unknown (0x${code.toString(16)})`;
      return `Panic: ${label}`;
    }

    // Unknown custom error: surface the selector so the caller can map it via ABI.
    return `custom error ${selector}`;
  } catch {
    return `revert (raw: ${data})`;
  }
}

/** Walk a thrown viem error to find embedded revert data (`0x...`). */
export function extractRevertData(err: unknown): Hex | undefined {
  if (err instanceof BaseError) {
    const walked = err.walk(
      (e) => typeof (e as { data?: unknown }).data === "string",
    ) as { data?: Hex } | null;
    if (walked?.data && walked.data.startsWith("0x")) return walked.data;
  }
  const anyErr = err as { data?: unknown; cause?: unknown };
  if (typeof anyErr?.data === "string" && anyErr.data.startsWith("0x")) {
    return anyErr.data as Hex;
  }
  return undefined;
}

/** Best-effort human message from a thrown viem error. */
export function extractRevertReason(err: unknown): string | undefined {
  const data = extractRevertData(err);
  const decoded = decodeRevertReason(data);
  if (decoded) return decoded;
  if (err instanceof BaseError) {
    return err.shortMessage || err.message;
  }
  if (err instanceof Error) return err.message;
  return undefined;
}
