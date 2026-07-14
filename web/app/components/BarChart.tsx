export interface BarDatum {
  label: string;
  value: number;
  colorVar: string;
}

/** A minimal horizontal bar chart, scaled to the largest value, labelled with real MON amounts. */
export function BarChart({ data, unit = "MON" }: { data: BarDatum[]; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  return (
    <div className="barchart" role="img" aria-label={data.map((d) => `${d.label}: ${d.value} ${unit}`).join(", ")}>
      {data.map((d) => {
        const pct = Math.max((d.value / max) * 100, 2);
        return (
          <div className="barchart-row" key={d.label}>
            <span className="barchart-label">{d.label}</span>
            <div className="barchart-track">
              <div
                className="barchart-fill"
                style={{ width: `${pct}%`, background: d.colorVar }}
              />
            </div>
            <span className="barchart-value mono" style={{ color: d.colorVar }}>
              {d.value.toPrecision(3)} {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
