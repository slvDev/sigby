/**
 * Motion design tokens — single source of truth.
 *
 * Duration tiers, easing curves, spring presets, stagger units.
 * Imported by every animating surface; re-declared nowhere.
 *
 * Tuning bias for the Berth popup is one tier shorter than a general
 * web app (see research §12.1): the popup opens because the user
 * clicked, so content beats orchestration.
 */

import type { Transition } from "motion/react";

/** Duration tokens in ms — canonical scale. */
export const duration = {
  micro: 100,
  short: 150,
  base: 200,
  medium: 250,
  long: 350,
  ceremony: 500,
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
  soft: { type: "spring", stiffness: 180, damping: 26, mass: 1 } satisfies Transition,
  snap: { type: "spring", stiffness: 320, damping: 30, mass: 1 } satisfies Transition,
  glide: { type: "spring", stiffness: 120, damping: 22, mass: 1 } satisfies Transition,
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
 * Stagger base unit for list reveals. Cap children at 5 in the popup;
 * past that, simultaneous reads faster than sequenced.
 */
export const stagger = {
  base: 0.02, // 20 ms — 5 children = 80 ms total orchestration
  tight: 0.015,
} as const;

/**
 * Canonical entrance for cards / rows. Translate 6 px + fade, short
 * easing. Reduced-motion path drops the translate; callers that need
 * that variant should read `useReducedMotion()` and substitute.
 */
export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
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
