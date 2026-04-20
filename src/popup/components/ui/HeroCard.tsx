import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { HERO_SHADOW, HERO_SURFACE } from "../../styles/theme";
import { getChainPalette, passkeyBeat } from "../../styles/signatureMotion";
import { useWalletStore } from "../../store";
import { useReducedMotion } from "../../hooks";

type HeroCardProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Balance hero card surface. The orb gradients interpolate when the
 * active chain changes ("tide shift"), and each successful chain
 * commit fires a single outward pulse — the passkey-beat language,
 * reused at the moment identity crosses waters.
 *
 * Chain palette comes from `chainCommittedAt` lineage: views observe
 * `chainId` for the *visual target* but only fire the pulse when
 * `chainCommittedAt` changes, so re-renders from unrelated store
 * updates never re-trigger the motion.
 */
export function HeroCard({ children, className = "", style }: HeroCardProps) {
  const chainId = useWalletStore((s) => s.chainId);
  const chainCommittedAt = useWalletStore((s) => s.chainCommittedAt);
  const reduced = useReducedMotion();
  const palette = getChainPalette(chainId);

  // Pulse debounced on timestamp change, not value change. A `null`
  // run means no commit has happened yet — orbs render static with
  // palette colours (no entrance keyframe burst). Each commit after
  // that increments `pulseRun` which keys the orbs so a fresh
  // keyframe animation mounts.
  const [pulseRun, setPulseRun] = useState<number | null>(null);
  useEffect(() => {
    if (chainCommittedAt) setPulseRun((n) => (n ?? 0) + 1);
  }, [chainCommittedAt]);

  const orbATarget = reduced
    ? { opacity: 0.5, backgroundImage: palette.orbA }
    : { opacity: 0.5, scale: 1, backgroundImage: palette.orbA };
  const orbBTarget = reduced
    ? { opacity: 0.4, backgroundImage: palette.orbB }
    : { opacity: 0.4, scale: 1, backgroundImage: palette.orbB };

  const orbAPulse = reduced
    ? { opacity: [0.5, 0.95, 0.5], backgroundImage: palette.orbA }
    : {
        opacity: [0.5, 0.78, 0.5],
        scale: [1, 1.35, 1],
        backgroundImage: palette.orbA,
      };
  const orbBPulse = reduced
    ? { opacity: [0.4, 0.88, 0.4], backgroundImage: palette.orbB }
    : {
        opacity: [0.4, 0.65, 0.4],
        scale: [1, 1.28, 1],
        backgroundImage: palette.orbB,
      };

  const pulseActive = pulseRun !== null;
  const pulseTransition = reduced
    ? passkeyBeat.reducedMotionTransition
    : passkeyBeat.transition;

  return (
    <div
      className={`relative overflow-hidden border border-white/70 ${className}`}
      style={{
        borderRadius: 22,
        background: HERO_SURFACE,
        boxShadow: HERO_SHADOW,
        backdropFilter: "blur(24px)",
        ...style,
      }}
    >
      {/* Orb A — top-right. Colour interpolates between palettes
          on chain change; one-beat pulse on each commit. */}
      <motion.div
        key={`orb-a-${pulseRun ?? "rest"}`}
        className="absolute -top-10 -right-8 w-40 h-40 rounded-full pointer-events-none"
        initial={orbATarget}
        animate={pulseActive ? orbAPulse : orbATarget}
        transition={pulseActive ? pulseTransition : { duration: 0.5 }}
        aria-hidden="true"
      />
      {/* Orb B — bottom-left. Same behaviour, different position. */}
      <motion.div
        key={`orb-b-${pulseRun ?? "rest"}`}
        className="absolute -bottom-12 -left-6 w-36 h-36 rounded-full pointer-events-none"
        initial={orbBTarget}
        animate={pulseActive ? orbBPulse : orbBTarget}
        transition={pulseActive ? pulseTransition : { duration: 0.5 }}
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
