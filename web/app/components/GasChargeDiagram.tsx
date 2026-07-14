/**
 * The actual problem, shown not told: what Ethereum-model chains charge (gas_used) vs what Monad
 * charges (gas_limit) for the same transaction, using the real numbers from Reckon's own live
 * demo (naive 200,000-gas limit vs a true execution cost of 23,838).
 */
export function GasChargeDiagram() {
  const trueUsed = 23838;
  const naiveLimit = 200000;
  const maxV = naiveLimit;
  const scale = (v: number) => Math.round((v / maxV) * 100);

  return (
    <svg
      viewBox="0 0 480 220"
      width="100%"
      height="100%"
      fill="none"
      role="img"
      aria-label="Diagram comparing gas charged on other chains (only gas used, 23,838) versus what Monad charges (the full declared limit, 200,000), even though the transaction only needed 23,838 gas."
    >
      <text x="0" y="20" fontFamily="var(--mono)" fontSize="11" fill="#9A9AA8">
        same transaction. true execution cost: 23,838 gas.
      </text>

      {/* Row 1: Ethereum-model chains */}
      <text x="0" y="55" fontFamily="var(--mono)" fontSize="11" fill="#9A9AA8">
        other EVM chains charge
      </text>
      <rect x="0" y="64" width={scale(trueUsed) * 3.0} height="22" rx="5" fill="#3FB950" opacity="0.85" />
      <text x={scale(trueUsed) * 3.0 + 10} y="80" fontFamily="var(--mono)" fontSize="12" fill="#3FB950">
        23,838 gas used
      </text>

      {/* Row 2: Monad */}
      <text x="0" y="130" fontFamily="var(--mono)" fontSize="11" fill="#9A9AA8">
        Monad charges (a naive 200k limit)
      </text>
      <rect x="0" y="139" width={scale(trueUsed) * 3.0} height="22" rx="5" fill="#3FB950" opacity="0.85" />
      <rect
        x={scale(trueUsed) * 3.0}
        y="139"
        width={(scale(naiveLimit) - scale(trueUsed)) * 3.0}
        height="22"
        rx="0"
        fill="#F85149"
        opacity="0.85"
      />
      <text x={scale(naiveLimit) * 3.0 + 10} y="155" fontFamily="var(--mono)" fontSize="12" fill="#F85149">
        200,000 gas limit
      </text>

      <line x1="0" y1="185" x2="480" y2="185" stroke="#26262F" />
      <text x="0" y="208" fontFamily="var(--mono)" fontSize="12.5" fill="#F85149" fontWeight="700">
        the red is pure overpay, charged even if the tx reverts.
      </text>
    </svg>
  );
}
