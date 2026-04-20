import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { spring } from "../../styles/motion";
import { useReducedMotion } from "../../hooks";

type NumberScrambleProps = {
  /** Final numeric value to land on. */
  value: number;
  /** Formatter for both the scramble and the landed value. */
  format: (v: number) => string;
  /** Trigger scramble when this key changes (e.g. active account). */
  scrambleKey?: string | number;
  /** Total scramble duration in ms before the final spring lands. */
  durationMs?: number;
  /** Optional className; tabular-nums already applied. */
  className?: string;
  /** Optional aria-label for the polite live region. */
  ariaLabel?: string;
};

/**
 * Balance scramble — cycles through random intermediate numeric values
 * before committing to the target. Different from `NumberTicker` in
 * intent: that one springs smoothly between two values, this one reads
 * as a deliberate identity shift (account switch) rather than a quiet
 * balance refresh.
 *
 * Chaos model: while scrambling, we render `random in [value * 0.3,
 * value * 2.4]` at ~60 Hz. On the final frame we spring to `value`
 * using the standard soft preset so the landing still feels like Berth.
 *
 * Reduced-motion: degrades to a tabular-nums cross-fade of the string
 * form (no numeric chaos).
 */
export function NumberScramble({
  value,
  format,
  scrambleKey,
  durationMs = 420,
  className = "",
  ariaLabel,
}: NumberScrambleProps) {
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (v) => format(v));
  const reduced = useReducedMotion();
  const [scrambling, setScrambling] = useState(false);
  const scrambleKeyRef = useRef(scrambleKey);
  const mountedRef = useRef(false);

  useEffect(() => {
    // On the very first mount, don't scramble — the caller generally
    // doesn't want a scramble animation for the first render in a
    // newly-opened popup (that's what the `docking`/stagger entrance
    // is for).
    if (!mountedRef.current) {
      mountedRef.current = true;
      scrambleKeyRef.current = scrambleKey;
      motionValue.set(value);
      return;
    }

    // Non-scramble updates: value changed but scrambleKey did not.
    // Spring smoothly (matches NumberTicker behaviour).
    if (scrambleKey === scrambleKeyRef.current) {
      const controls = animate(motionValue, value, spring.soft);
      return () => controls.stop();
    }

    scrambleKeyRef.current = scrambleKey;

    if (reduced) {
      motionValue.set(value);
      return;
    }

    setScrambling(true);
    const rangeLo = Math.max(0, value * 0.3);
    const rangeHi = value * 2.4 || 1;
    const intervalMs = 48;
    const ticks = Math.max(1, Math.floor(durationMs / intervalMs));
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      if (tick >= ticks) {
        window.clearInterval(id);
        setScrambling(false);
        animate(motionValue, value, spring.soft);
        return;
      }
      motionValue.set(rangeLo + Math.random() * (rangeHi - rangeLo));
    }, intervalMs);

    return () => {
      window.clearInterval(id);
      setScrambling(false);
    };
  }, [value, scrambleKey, reduced, durationMs, motionValue]);

  return (
    <>
      <motion.span
        className={`tabular-nums ${className}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
        aria-hidden="true"
        // While scrambling, keep the display slightly less emphatic so
        // the chaos reads as intermediate state, not a real value.
        animate={{ opacity: scrambling ? 0.78 : 1 }}
        transition={{ duration: 0.12 }}
      >
        {display}
      </motion.span>
      <span className="sr-only" aria-live="polite">
        {ariaLabel ? `${ariaLabel}: ${format(value)}` : format(value)}
      </span>
    </>
  );
}
