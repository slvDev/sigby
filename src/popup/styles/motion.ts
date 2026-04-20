/**
 * Motion design tokens — single source of truth.
 *
 * Duration tiers, easing curves, spring presets, stagger units.
 * Imported by every animating surface; re-declared nowhere.
 *
 * Initially tuned per research §12.1 ("one tier shorter than general
 * UI") but the motion read as too fast to register — moments landed
 * before the eye caught them. Now on the general-UI tier: 200–420 ms
 * is the meat, 560 ms for spatial, 720 ms for ceremony.
 */

import type { Transition } from "motion/react";

/** Duration tokens in ms — canonical scale. */
export const duration = {
  micro: 120,
  short: 200,
  base: 300,
  medium: 600,
  long: 800,
  ceremony: 900,
} as const;

/**
 * Easing curves used across the app. Keys mirror the CSS custom
 * properties declared in `tailwind.css @theme` so prose & utility
 * classes stay in lockstep.
 */
export const easing = {
  out: [0.2, 0, 0, 1] as const,
  outStrong: [0.16, 1, 0.3, 1] as const,
  outSoft: [0.22, 0.61, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  inQuiet: [0.4, 0, 1, 1] as const,
} as const;

/**
 * Spring presets. Critically-damped by default — a wallet is not a
 * toy. `elasticReject` is the ONLY bouncy preset and it exists solely
 * for invalid-input shakes; never use it on money, signatures, or
 * success affirmations.
 */
export const spring = {
  // Lower stiffness = longer settle. Kept critically damped
  // (damping / 2√stiffness ≥ 1) so there's no overshoot.
  soft: { type: "spring", stiffness: 140, damping: 22, mass: 1 } satisfies Transition,
  // Snap stays stiff — press feedback must feel immediate.
  snap: { type: "spring", stiffness: 320, damping: 30, mass: 1 } satisfies Transition,
  glide: { type: "spring", stiffness: 90, damping: 20, mass: 1 } satisfies Transition,
  elasticReject: {
    type: "spring",
    stiffness: 520,
    damping: 18,
    mass: 1,
    bounce: 0.18,
  } satisfies Transition,
} as const;

/**
 * Tween presets keyed to the duration + easing pair. These are the
 * right default for entrances/exits; springs are for continuous
 * state (drag, layout, tickers).
 */
export const tween = {
  microOut: {
    type: "tween",
    duration: duration.micro / 1000,
    ease: easing.out,
  } satisfies Transition,
  shortOut: {
    type: "tween",
    duration: duration.short / 1000,
    ease: easing.out,
  } satisfies Transition,
  baseOut: {
    type: "tween",
    duration: duration.base / 1000,
    ease: easing.out,
  } satisfies Transition,
  mediumOutStrong: {
    type: "tween",
    duration: duration.medium / 1000,
    ease: easing.outStrong,
  } satisfies Transition,
  shortInQuiet: {
    type: "tween",
    duration: duration.short / 1000,
    ease: easing.inQuiet,
  } satisfies Transition,
} as const;

/**
 * Stagger base unit for list reveals. Cap children at 5; past that,
 * simultaneous reads faster than sequenced.
 */
export const stagger = {
  base: 0.05, // 50 ms — 5 children = 200 ms total orchestration
  tight: 0.035,
} as const;

/**
 * Canonical entrance for cards / rows. Translate 12 px + fade.
 * Reduced-motion path drops the translate; callers that read
 * `useReducedMotion()` substitute manually.
 *
 * Keys are `hidden` / `show` / `exit` (not `initial` / `animate` /
 * `exit`) so the variant names match the parent directive
 * `initial="hidden" animate="show"` used for staggered pages. Without
 * matching names variant propagation silently fails — children render
 * static.
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
} as const;

/** Backdrop / scrim fade — opacity only, no translate. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

/**
 * Modal/sheet entrance — slight scale + fade, origin-anchored. Keep
 * scale drop shallow (0.96) — deeper reads theatrical.
 */
export const scaleFade = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
} as const;
