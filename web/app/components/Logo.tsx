/** Constructed brand mark: a shield (seatbelt/guard) with a check, in the locked accent. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6l-9-4Z"
        stroke="#836EF9"
        strokeWidth="1.6"
        fill="rgba(131,110,249,0.12)"
      />
      <path d="M8.5 12.2l2.6 2.6 4.6-5.1" stroke="#A996FF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
