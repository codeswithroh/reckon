/**
 * Constructed hero visual: a transaction flowing through Reckon's pre-flight check into its two
 * real outcomes (BLOCK / OK), annotated with the actual numbers from the live demo run. This is a
 * diagram of the real mechanism, not decorative stock art.
 */
export function HeroDiagram() {
  return (
    <svg
      viewBox="0 0 420 360"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Diagram: a transaction enters Reckon's pre-flight check, which either blocks a doomed transaction before broadcast or sends a healthy one with a tight gas limit."
    >
      <defs>
        <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#836EF9" stopOpacity="0.35" />
          <stop offset="1" stopColor="#836EF9" stopOpacity="0" />
        </linearGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* backdrop glow */}
      <ellipse cx="210" cy="150" rx="170" ry="120" fill="url(#glow)" />

      {/* incoming tx node */}
      <g>
        <rect x="16" y="132" width="88" height="36" rx="8" fill="#14141B" stroke="#26262F" />
        <text x="60" y="154" textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill="#9A9AA8">
          tx.send()
        </text>
      </g>

      {/* connector into shield */}
      <path d="M104 150 H160" stroke="#26262F" strokeWidth="1.5" />
      <circle cx="160" cy="150" r="2.5" fill="#836EF9" />

      {/* Reckon shield/checkpoint */}
      <g filter="url(#soft)" opacity="0.5">
        <circle cx="210" cy="150" r="46" fill="#836EF9" opacity="0.25" />
      </g>
      <g>
        <path
          d="M210 108 L246 122 V150 C246 176 230 194 210 202 C190 194 174 176 174 150 V122 Z"
          fill="#1B1B24"
          stroke="#836EF9"
          strokeWidth="1.6"
        />
        <path
          d="M195 151 L206 162 L227 137"
          stroke="#A996FF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
      <text x="210" y="222" textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="#A996FF">
        reckon.preflight()
      </text>

      {/* fork connectors */}
      <path d="M246 138 C 280 138, 300 108, 330 92" stroke="#26262F" strokeWidth="1.5" fill="none" />
      <path d="M246 162 C 280 162, 300 192, 330 208" stroke="#26262F" strokeWidth="1.5" fill="none" />

      {/* OK outcome */}
      <g>
        <rect x="330" y="70" width="82" height="52" rx="8" fill="#14141B" stroke="#3FB950" strokeOpacity="0.4" />
        <text x="371" y="90" textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fontWeight="600" fill="#3FB950">
          OK
        </text>
        <text x="371" y="106" textAnchor="middle" fontFamily="var(--mono)" fontSize="9.5" fill="#9A9AA8">
          gas: 23,838
        </text>
      </g>

      {/* BLOCK outcome */}
      <g>
        <rect x="330" y="182" width="82" height="52" rx="8" fill="#14141B" stroke="#F85149" strokeOpacity="0.4" />
        <text x="371" y="202" textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fontWeight="600" fill="#F85149">
          BLOCK
        </text>
        <text x="371" y="218" textAnchor="middle" fontFamily="var(--mono)" fontSize="9.5" fill="#9A9AA8">
          0 MON spent
        </text>
      </g>

      {/* baseline row: naive vs reckon */}
      <g>
        <line x1="16" y1="292" x2="404" y2="292" stroke="#26262F" strokeWidth="1" />
        <text x="16" y="316" fontFamily="var(--mono)" fontSize="10.5" fill="#9A9AA8">
          naive agent burned
        </text>
        <text x="16" y="336" fontFamily="var(--mono)" fontSize="16" fontWeight="700" fill="#F85149">
          0.0408 MON
        </text>
        <text x="404" y="316" textAnchor="end" fontFamily="var(--mono)" fontSize="10.5" fill="#9A9AA8">
          reckon-guarded spent
        </text>
        <text x="404" y="336" textAnchor="end" fontFamily="var(--mono)" fontSize="16" fontWeight="700" fill="#3FB950">
          0.0024 MON
        </text>
      </g>
    </svg>
  );
}
