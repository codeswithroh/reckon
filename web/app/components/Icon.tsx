/**
 * Inline icon set, sourced from Iconify's Lucide set via tastemaker's fetch_icons.py
 * (design/assets/icons/*.svg), inlined here as `currentColor` paths so each usage can tint via
 * CSS `color` rather than baking one fixed hex into every instance. One stroke weight (2),
 * one visual family, throughout the site.
 */
const paths: Record<string, string> = {
  "shield-check":
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z|m9 12l2 2l4-4",
  zap: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  terminal: "M12 19h8M4 17l6-6l-6-6",
  bot: "M12 8V4H8|M4 8h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z|M2 14h2m16 0h2m-7-1v2m-6-2v2",
  "link-2": "M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2m-7-5h8",
  "alert-triangle":
    "m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01",
  "check-circle-2": "m9 12l2 2l4-4",
  "x-circle": "m15 9l-6 6m0-6l6 6",
  "bar-chart-3": "M3 3v18h18|M18 17V9|M13 17V5|M8 17v-3",
  wallet:
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1|M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  "code-2": "m18 16l4-4l-4-4M6 8l-4 4l4 4m8.5-12l-5 16",
  fuel: "M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5m-4 16V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16m-1 0h13M3 9h11",
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const raw = paths[name];
  if (!raw) return null;
  const segments = raw.split("|");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {name === "bot" && <rect x="4" y="8" width="16" height="12" rx="2" />}
      {(name === "check-circle-2" || name === "x-circle") && <circle cx="12" cy="12" r="10" />}
      {segments
        .filter((s) => s.trim().length > 0)
        .map((d, i) => (
          <path key={i} d={d} />
        ))}
    </svg>
  );
}
