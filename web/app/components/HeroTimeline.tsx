"use client";
import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { ensureGsapRegistered, gsap } from "../lib/motion";

/**
 * Sequenced hero entrance: eyebrow -> headline -> tagline -> subhead -> CTA -> visual, each
 * stepping in rather than all appearing at once — the single highest-impact motion moment on the
 * page, since it's the first thing seen. Scoped to `.hero` so it only touches this page's hero.
 */
export function HeroTimeline({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      ensureGsapRegistered();
      const mm = gsap.matchMedia();

      mm.add(
        {
          motionOK: "(prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const reduce = Boolean((context.conditions as Record<string, boolean>)?.reduceMotion);
          const root = scope.current;
          if (!root) return;

          const steps = [
            root.querySelector(".eyebrow"),
            root.querySelector("h1"),
            root.querySelector(".tagline"),
            root.querySelector(".subhead"),
            root.querySelector(".cta-row"),
            root.querySelector(".hero-visual"),
          ].filter(Boolean) as Element[];

          if (reduce) {
            gsap.set(steps, { opacity: 1, y: 0 });
            return;
          }

          gsap.set(steps, { opacity: 0, y: 14 });
          const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 0.45 } });
          steps.forEach((el, i) => {
            tl.to(el, { opacity: 1, y: 0 }, i === 0 ? 0 : "-=0.28");
          });
        },
      );
    },
    { scope },
  );

  return (
    <div ref={scope} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
