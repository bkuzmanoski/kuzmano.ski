import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion.ts";

import { MOTION_DURATION_MS, REDUCED_MOTION_DURATION_MS } from "./phases.ts";

import type { Motion } from "./phases.ts";

export const useMotionDurations = (): Motion =>
  usePrefersReducedMotion() ? REDUCED_MOTION_DURATION_MS : MOTION_DURATION_MS;
