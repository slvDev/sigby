import { AnimatePresence, motion } from "motion/react";
import { spring } from "../../styles/motion";
import { useReducedMotion } from "../../hooks";

type InitialMorphProps = {
  /** Single character to render (typically first letter of a name). */
  initial: string;
  /** Diameter + layout handled by caller via className on the parent. */
  className?: string;
};

/**
 * Account initial that remorphs on change — 180° Y rotation + scale +
 * crossfade. Reads as identity swap, not a label update.
 *
 * Use as a drop-in for a static `<span>` containing the initial. The
 * surrounding avatar ring (gradient fill, border) belongs on the
 * parent element.
 *
 * Reduced-motion: instant swap via key-based remount, no rotation.
 */
export function InitialMorph({ initial, className = "" }: InitialMorphProps) {
  const reduced = useReducedMotion();
  const char = initial.slice(0, 1).toUpperCase() || "A";

  if (reduced) {
    return <span className={className}>{char}</span>;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={char}
        initial={{ opacity: 0, rotateY: -90, scale: 0.85 }}
        animate={{ opacity: 1, rotateY: 0, scale: 1 }}
        exit={{ opacity: 0, rotateY: 90, scale: 0.85 }}
        transition={spring.snap}
        style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
        className={`inline-block ${className}`}
      >
        {char}
      </motion.span>
    </AnimatePresence>
  );
}
