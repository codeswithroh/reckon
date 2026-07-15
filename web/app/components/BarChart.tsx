"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { ensureGsapRegistered, gsap } from "../lib/motion";

export interface BarDatum {
  label: string;
  value: number;
  colorVar: string;
}

/**
 * A minimal horizontal bar chart, scaled to the largest value, labelled with real MON amounts.
 * Fills animate in via `scaleX` (transform, not `width`) when scrolled into view, so the growth
 * is GPU-accelerated rather than triggering layout on every frame.
 */
export function BarChart({ data, unit = "MON" }: { data: BarDatum[]; unit?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  const max = Math.max(...data.map((d) => d.value), 0.0001);

  useGSAP(
    () => {
      ensureGsapRegistered();
      const root = scope.current;
      if (!root) return;
      const fills = root.querySelectorAll<HTMLElement>(".barchart-fill");
      const mm = gsap.matchMedia();

      mm.add(
        {
          motionOK: "(prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const reduce = Boolean((context.conditions as Record<string, boolean>)?.reduceMotion);
          if (reduce) {
            gsap.set(fills, { scaleX: 1 });
            return;
          }
          gsap.set(fills, { scaleX: 0, transformOrigin: "left center" });
          gsap.to(fills, {
            scaleX: 1,
            duration: 0.8,
            ease: "power2.out",
            stagger: 0.12,
            scrollTrigger: { trigger: root, start: "top 85%", once: true },
          });
        },
      );
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      className="barchart"
      role="img"
      aria-label={data.map((d) => `${d.label}: ${d.value} ${unit}`).join(", ")}
    >
      {data.map((d) => {
        const pct = Math.max((d.value / max) * 100, 2);
        return (
          <div className="barchart-row" key={d.label}>
            <span className="barchart-label">{d.label}</span>
            <div className="barchart-track">
              <div className="barchart-fill" style={{ width: `${pct}%`, background: d.colorVar }} />
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
