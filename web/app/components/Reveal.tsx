"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { ensureGsapRegistered, gsap, MOTION } from "../lib/motion";

/**
 * GSAP + ScrollTrigger reveal controller — the default motion engine (see
 * .tastemaker/style-lock.md). Ported from the tastemaker gsap-starter.js CDN script to a React
 * `useGSAP` hook (correct cleanup on unmount, which plain useEffect + ScrollTrigger easily gets
 * wrong). Same [data-reveal] / [data-reveal-group] markup convention as before, so no page changes
 * were needed to adopt it.
 *
 * Branches on prefers-reduced-motion via gsap.matchMedia(): reduced-motion gets the correct end
 * state instantly, not skipped animation code.
 */
export function RevealController() {
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
          const duration = reduce ? 0.01 : MOTION.duration;
          const distance = reduce ? 0 : MOTION.distance;

          document.querySelectorAll("[data-reveal]").forEach((el) => {
            const isGroup = el.hasAttribute("data-reveal-group");
            const targets = isGroup ? el.children : el;

            gsap.set(targets, { opacity: 0, y: distance });

            gsap.to(targets, {
              opacity: 1,
              y: 0,
              duration,
              ease: MOTION.ease,
              stagger: isGroup ? (reduce ? 0 : MOTION.staggerStep) : 0,
              scrollTrigger: {
                trigger: el as Element,
                start: "top 85%",
                once: true,
              },
            });
          });
        },
      );
    },
    { scope },
  );

  // Invisible; exists only to run the effect and provide a scope root.
  return <div ref={scope} style={{ display: "none" }} aria-hidden />;
}
