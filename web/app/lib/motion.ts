import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** Register ScrollTrigger once, client-side only. */
export function ensureGsapRegistered() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

/** Motion feel locked in .tastemaker/style-lock.md: quick, restrained, no bounce. */
export const MOTION = {
  duration: 0.5,
  distance: 8,
  ease: "power2.out",
  staggerStep: 0.08,
} as const;

export { gsap, ScrollTrigger };
