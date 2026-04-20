import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useWalletStore, type CelebrationKind } from "../../store";
import { useReducedMotion } from "../../hooks";
import { easing } from "../../styles/motion";

type CelebrationGlowProps = {
  kind: CelebrationKind;
  /**
   * RGB triplet (no alpha) — the box-shadow colour of the one-beat
   * pulse. Defaults to accent blue so it matches primary CTAs.
   */
  color?: string;
  /** `rounded-full`-style class on the motion wrapper. */
  className?: string;
  children: ReactNode;
};

/**
 * Wraps any element (typically the primary approval CTA) with a
 * one-beat box-shadow pulse that fires when the named celebration
 * timestamp advances. Debounces on timestamp change, not value
 * change — re-renders from unrelated store updates don't re-fire.
 *
 * Reduced-motion: opacity-only flash, no ring.
 */
export function CelebrationGlow({
  kind,
  color = "37,99,235",
  className = "",
  children,
}: CelebrationGlowProps) {
  const at = useWalletStore((s) => s.celebrations[kind]);
  const reduced = useReducedMotion();
  const [run, setRun] = useState<number | null>(null);

  useEffect(() => {
    if (at) setRun((n) => (n ?? 0) + 1);
  }, [at]);

  const active = run !== null;

  return (
    <motion.div
      key={`glow-${kind}-${run ?? "rest"}`}
      className={className}
      animate={
        active
          ? reduced
            ? { opacity: [1, 0.7, 1] }
            : {
                boxShadow: [
                  `0 0 0 0 rgba(${color},0)`,
                  `0 0 0 12px rgba(${color},0.28)`,
                  `0 0 0 0 rgba(${color},0)`,
                ],
              }
          : undefined
      }
      transition={{ duration: 0.9, ease: easing.out }}
    >
      {children}
    </motion.div>
  );
}
