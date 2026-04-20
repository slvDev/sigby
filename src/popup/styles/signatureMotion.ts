/**
 * Signature motion — Berth's memorable beats.
 *
 * Four moments land here:
 *   1. Passkey success beat (orb pulse) — HeroCard + approval CTAs.
 *   2. Chain tide shift — HeroCard palette interpolates on commit.
 *   3. Account remorph — scramble primitives compose with this palette.
 *   4. Approval docking — one-beat arrival with a kissed-bounce spring.
 *
 * All four collapse to fade-only under `prefers-reduced-motion` via
 * the primitives themselves (they read `useReducedMotion()` internally).
 * This file exports the tokens; the primitives live in `components/ui/`.
 */

import type { Transition } from "motion/react";
import { easing } from "./motion";

/**
 * Chain identity palette. Each chain maps to the triad HeroCard uses:
 * two radial-gradient orb colors + an accent ink. Testnets inherit
 * their mainnet sibling's palette (same identity, just not real money).
 *
 * Palette structure is stable across chains (two stops per orb,
 * same RGBA shape) so Motion can tween between them without
 * falling back to an instant swap.
 */
export type ChainPalette = {
  name: string;
  /** Top-right orb gradient — center RGBA, outer RGBA. */
  orbA: string;
  /** Bottom-left orb gradient. */
  orbB: string;
  /** Accent ink used on active indicators / links. */
  accent: string;
};

const neutral: ChainPalette = {
  name: "Unknown",
  orbA:
    "radial-gradient(closest-side, rgba(99,102,241,0.55), rgba(99,102,241,0) 70%)",
  orbB:
    "radial-gradient(closest-side, rgba(236,72,153,0.45), rgba(236,72,153,0) 70%)",
  accent: "#2563eb",
};

const ethereum: ChainPalette = {
  name: "Ethereum",
  orbA:
    "radial-gradient(closest-side, rgba(139,92,246,0.55), rgba(139,92,246,0) 70%)",
  orbB:
    "radial-gradient(closest-side, rgba(99,102,241,0.45), rgba(99,102,241,0) 70%)",
  accent: "#8b5cf6",
};

const base: ChainPalette = {
  name: "Base",
  orbA:
    "radial-gradient(closest-side, rgba(59,130,246,0.55), rgba(59,130,246,0) 70%)",
  orbB:
    "radial-gradient(closest-side, rgba(14,165,233,0.45), rgba(14,165,233,0) 70%)",
  accent: "#2563eb",
};

const arbitrum: ChainPalette = {
  name: "Arbitrum",
  orbA:
    "radial-gradient(closest-side, rgba(100,116,139,0.55), rgba(100,116,139,0) 70%)",
  orbB:
    "radial-gradient(closest-side, rgba(59,130,246,0.40), rgba(59,130,246,0) 70%)",
  accent: "#475569",
};

const optimism: ChainPalette = {
  name: "Optimism",
  orbA:
    "radial-gradient(closest-side, rgba(239,68,68,0.50), rgba(239,68,68,0) 70%)",
  orbB:
    "radial-gradient(closest-side, rgba(244,114,182,0.40), rgba(244,114,182,0) 70%)",
  accent: "#ef4444",
};

const polygon: ChainPalette = {
  name: "Polygon",
  orbA:
    "radial-gradient(closest-side, rgba(124,58,237,0.55), rgba(124,58,237,0) 70%)",
  orbB:
    "radial-gradient(closest-side, rgba(168,85,247,0.40), rgba(168,85,247,0) 70%)",
  accent: "#7c3aed",
};

/**
 * Full chainId map. Mainnets + their testnet siblings resolve to the
 * same palette so the identity is chain-family, not chain-variant.
 */
const chainPalette: Record<number, ChainPalette> = {
  1: ethereum,
  11155111: ethereum, // sepolia
  17000: ethereum,    // holesky
  8453: base,
  84532: base,        // base sepolia
  42161: arbitrum,
  421614: arbitrum,   // arbitrum sepolia
  10: optimism,
  11155420: optimism, // optimism sepolia
  137: polygon,
  80002: polygon,     // polygon amoy
};

export function getChainPalette(chainId: number): ChainPalette {
  return chainPalette[chainId] ?? neutral;
}

/**
 * Approval docking — one-beat arrival for `chrome.windows.create`
 * approval windows. The tiny positive bounce is the hull kissing the
 * berth; any more reads as cartoon. Never repeats; fires once per
 * window lifetime.
 *
 * Reduced-motion: primitives that consume this substitute an
 * opacity-only fade (no y, no scale, no bounce).
 */
export const docking = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: {
    type: "spring",
    stiffness: 260,
    damping: 28,
    mass: 1,
    bounce: 0.06,
  } satisfies Transition,
  reducedMotion: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { type: "tween", duration: 0.18, ease: easing.out } satisfies Transition,
  },
} as const;

/**
 * Passkey success beat — one outward pulse on HeroCard orbs or on a
 * CTA glyph. Emitted by the `celebrations` store slice; views key on
 * the latest timestamp so each fire mounts a fresh keyframe run.
 *
 * Timing breakdown (total 900 ms):
 *   0     rest     scale 1, opacity 0.5
 *   35%   crest    scale 1.35, opacity 0.78
 *   100%  settle   scale 1, opacity 0.5
 *
 * Reduced-motion substitute: opacity-only flash 1 → 0.9 → 1 at short
 * tier. No scale. Primitives gate on `useReducedMotion()`.
 */
export const passkeyBeat = {
  keyframes: {
    scale: [1, 1.35, 1],
    opacity: [0.5, 0.78, 0.5],
  },
  transition: {
    duration: 0.9,
    ease: easing.out,
    times: [0, 0.35, 1],
  } satisfies Transition,
  reducedMotionKeyframes: {
    opacity: [0.5, 0.95, 0.5],
  },
  reducedMotionTransition: {
    duration: 0.32,
    ease: easing.out,
  } satisfies Transition,
  /**
   * Total perceived duration including settle tail. Used by
   * `awaitCelebration(kind, { settleMs })` so approval hooks can
   * defer `window.close()` until the beat resolves.
   */
  settleMs: 600,
} as const;

/**
 * Duration budgets for the remorph primitives. Kept here (not inside
 * the primitives) so timing stays consistent across InitialMorph,
 * NumberScramble, HexScramble firing in the same frame on account
 * switch.
 */
export const remorphMs = {
  initial: 380,
  number: 450,
  hex: 420,
} as const;
