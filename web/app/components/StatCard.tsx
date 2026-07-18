import { Icon, type IconName } from "./Icon";

export function StatCard({
  icon,
  tone = "accent",
  value,
  label,
}: {
  icon: IconName;
  tone?: "accent" | "ok" | "warn" | "block";
  value: string;
  label: string;
}) {
  return (
    <div className="kpi-card" data-reveal>
      <div className="kpi-card-top">
        <span className={`kpi-icon ${tone}`}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="kpi-num">{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  );
}
