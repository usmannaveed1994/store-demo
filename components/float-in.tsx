"use client";

import { MotionConfig, motion, type Easing } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FloatInProps = {
  children: ReactNode;
  /** `down` starts above its resting spot, `up` starts below it. */
  from?: "up" | "down";
  /** Seconds to hold before the drift starts, used for staggering. */
  delay?: number;
  className?: string;
};

/** Small enough to read as a drift rather than a slide. */
const FLOAT_DISTANCE = 16;

/** Decelerating curve so the copy settles instead of stopping. */
const FLOAT_EASE: Easing = [0.22, 1, 0.36, 1];

/**
 * Landing entrance for hero content.
 *
 * `reducedMotion="user"` keeps the fade but drops the movement for visitors who
 * ask for reduced motion, without a render-time media query, so the server and
 * client markup stay identical.
 */
export function FloatIn({ children, from = "up", delay = 0, className }: FloatInProps) {
  const offset = from === "down" ? -FLOAT_DISTANCE : FLOAT_DISTANCE;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={cn(className)}
        initial={{ opacity: 0, y: offset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay, ease: FLOAT_EASE }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
