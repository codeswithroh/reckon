/** Minimal ABI for the deployed GuardedExecutor (see contracts/). */
export const guardedExecutorAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "gasCap", type: "uint256" },
        ],
      },
      { name: "atomic", type: "bool" },
    ],
    outputs: [
      {
        name: "results",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
          { name: "gasUsed", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "maxValuePerCall", type: "uint256" },
          { name: "maxTotalValue", type: "uint256" },
          { name: "maxGasPrice", type: "uint256" },
          { name: "useAllowlist", type: "bool" },
          { name: "set", type: "bool" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAllowlist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "maxValuePerCall", type: "uint256" },
          { name: "maxTotalValue", type: "uint256" },
          { name: "maxGasPrice", type: "uint256" },
          { name: "useAllowlist", type: "bool" },
          { name: "set", type: "bool" },
        ],
      },
    ],
  },
] as const;

/** GuardedExecutor deployment on Monad testnet (chainId 10143). */
export const GUARDED_EXECUTOR_TESTNET =
  "0x84e5C3c524f473c19821ae2D1494b274730bB6AE" as const;
