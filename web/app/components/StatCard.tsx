import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

export function StatCard({
  icon,
  tone = "accent",
  value,
  label,
  tooltip,
}: {
  icon: IconName;
  tone?: "accent" | "ok" | "warn" | "block";
  value: string;
  label: string;
  tooltip?: string;
}) {
  return (
    <div className="kpi-card" data-reveal>
      <div className="kpi-card-top">
        <span className={`kpi-icon ${tone}`}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="kpi-num">{value}</div>
      <div className="kpi-lbl">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </div>
    </div>
  );
}
