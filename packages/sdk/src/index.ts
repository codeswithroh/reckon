export { ReckonClient, createReckonClient } from "./client.js";
export type { ReckonClientConfig, GuardedCall } from "./client.js";
export { createGuardedProvider } from "./guardedProvider.js";
export type { Eip1193Provider, GuardOptions } from "./guardedProvider.js";
export { guardedExecutorAbi, GUARDED_EXECUTOR_TESTNET } from "./abi.js";

// Re-export the core surface so SDK users have one import.
export {
  monadTestnet,
  preflight,
  safeSend,
  ReckonRefusedError,
  recommendGasLimit,
  feeForLimit,
  detectRiskFlags,
  summarizeRiskFlags,
  fetchHistoricalGasUsage,
  computeAdaptiveBuffer,
  recommendAdaptiveGasLimit,
} from "@reckon/core";
export type {
  ReckonTxRequest,
  PreflightOptions,
  PreflightVerdict,
  SafeSendResult,
  RiskFlag,
  AdaptiveConfidence,
  HistoricalGasScanOptions,
  AdaptiveBufferResult,
  AdaptiveGasLimitResult,
} from "@reckon/core";
