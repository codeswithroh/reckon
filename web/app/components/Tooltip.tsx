/**
 * Lightweight, CSS-only tooltip (hover + keyboard focus, no JS positioning). Used to move detail
 * out of always-visible prose and into on-demand hover text, per the "reduce text density" pass.
 */
export function Tooltip({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <span className="tt-wrap" tabIndex={0}>
      {children ?? <span className="tt-dot">?</span>}
      <span className="tt-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
