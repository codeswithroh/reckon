import { encodeFunctionData, getAddress, type Hex } from "viem";

export const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
export const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");
export const DEMO_FROM = getAddress("0xD02aD9e6ee5Cb8eC8Add5E7c630C4f4dE5018867");
export const GUARDED_EXECUTOR = getAddress("0x84e5C3c524f473c19821ae2D1494b274730bB6AE");

const getEthBalance = (addr: `0x${string}`): Hex =>
  encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "getEthBalance",
        stateMutability: "view",
        inputs: [{ name: "addr", type: "address" }],
        outputs: [{ name: "b", type: "uint256" }],
      },
    ],
    functionName: "getEthBalance",
    args: [addr],
  });

const bogusPyth: Hex = encodeFunctionData({
  abi: [
    {
      type: "function",
      name: "getPriceUnsafe",
      stateMutability: "view",
      inputs: [{ name: "id", type: "bytes32" }],
      outputs: [{ name: "p", type: "int64" }],
    },
  ],
  functionName: "getPriceUnsafe",
  args: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
});

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  expect: "OK" | "BLOCK";
  tx: { from: string; to?: string; data?: string; value?: string };
}

export const PRESETS: Preset[] = [
  {
    id: "pyth-bogus",
    label: "Bogus oracle read",
    blurb: "Reads a Pyth price feed that doesn't exist, reverts (PriceFeedNotFound).",
    expect: "BLOCK",
    tx: { from: DEMO_FROM, to: PYTH, data: bogusPyth },
  },
  {
    id: "empty-call",
    label: "Malformed contract call",
    blurb: "Calls a contract with empty calldata that hits no function, reverts.",
    expect: "BLOCK",
    tx: { from: DEMO_FROM, to: MULTICALL3, data: "0x" },
  },
  {
    id: "healthy-read",
    label: "Healthy contract call",
    blurb: "A well-formed Multicall3 read succeeds; Reckon sizes the gas tightly.",
    expect: "OK",
    tx: { from: DEMO_FROM, to: MULTICALL3, data: getEthBalance(DEMO_FROM) },
  },
  {
    id: "native-transfer",
    label: "Native MON transfer",
    blurb: "A plain transfer. Reckon recommends the exact 21,000-gas limit.",
    expect: "OK",
    tx: { from: DEMO_FROM, to: "0x000000000000000000000000000000000000dEaD", value: "0" },
  },
];
