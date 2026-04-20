import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { spring } from "../../styles/motion";

type NumberTickerProps = {
  /** Current numeric value. Changes are animated. */
  value: number;
  /** Formatter applied to the intermediate motion value. Keep cheap. */
  format: (v: number) => string;
  /** Optional className (tabular-nums is already applied). */
  className?: string;
  /** Optional aria-label announced once per commit via a polite live region. */
  ariaLabel?: string;
};

/**
 * Monetary ticker. Spring-animates between numeric values and renders
 * the interpolated number through a caller-supplied formatter. Spring
 * is `soft` — critically-damped, no overshoot (research §6.6: never
 * bouncy springs on money).
 *
 * The visible span is `aria-hidden` because during the animation it
 * reads as an interpolated intermediate — screen readers would narrate
 * junk. A paired `aria-live="polite"` region emits the final formatted
 * value once when the animation commits.
 */
export function NumberTicker({
  value,
  format,
  className = "",
  ariaLabel,
}: NumberTickerProps) {
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (v) => format(v));

  useEffect(() => {
    const controls = animate(motionValue, value, spring.soft);
    return () => controls.stop();
  }, [value, motionValue]);

  return (
    <>
      <motion.span
        className={`tabular-nums ${className}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
        aria-hidden="true"
      >
        {display}
      </motion.span>
      <span className="sr-only" aria-live="polite">
        {ariaLabel ? `${ariaLabel}: ${format(value)}` : format(value)}
      </span>
    </>
  );
}
