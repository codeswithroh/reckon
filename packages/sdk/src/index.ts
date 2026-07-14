export { ReckonClient, createReckonClient } from "./client.js";
export type { ReckonClientConfig, GuardedCall } from "./client.js";
export { guardedExecutorAbi, GUARDED_EXECUTOR_TESTNET } from "./abi.js";

// Re-export the core surface so SDK users have one import.
export {
  monadTestnet,
  preflight,
  safeSend,
  ReckonRefusedError,
  recommendGasLimit,
  feeForLimit,
} from "@reckon/core";
export type {
  ReckonTxRequest,
  PreflightOptions,
  PreflightVerdict,
  SafeSendResult,
} from "@reckon/core";
