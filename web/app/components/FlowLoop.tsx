import { Icon, type IconName } from "./Icon";

const STEPS: Array<{ icon: IconName; label: string }> = [
  { icon: "wallet", label: "Connect" },
  { icon: "shield-check", label: "Reckon checks" },
  { icon: "check-circle-2", label: "You decide" },
];

/**
 * The whole app's mental model, in one glance, instead of a paragraph on every panel explaining
 * it again. Replaces prose with the actual 3-step loop.
 */
export function FlowLoop() {
  return (
    <div className="flow-loop" data-reveal>
      {STEPS.map((s, i) => (
        <span className="flow-step-wrap" key={s.label}>
          <span className="flow-step">
            <span className="flow-icon">
              <Icon name={s.icon} size={14} />
            </span>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="flow-arrow">&rarr;</span>}
        </span>
      ))}
    </div>
  );
}
