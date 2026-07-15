"use client";
import { useEffect, useRef } from "react";
import { ensureGsapRegistered, gsap } from "../lib/motion";

/**
 * Counts a number up from 0 to `value` as it scrolls into view — ties motion to real data
 * (the proof stats) rather than decoration. Respects prefers-reduced-motion (snaps to the final
 * value instead of animating).
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    ensureGsapRegistered();
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;

    if (reduce) {
      el.textContent = format(value);
      return;
    }

    el.textContent = format(0);
    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = format(obj.n);
      },
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });

    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
