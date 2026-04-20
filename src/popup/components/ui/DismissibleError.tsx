import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring, tween } from "../../styles/motion";

type DismissibleErrorProps = {
  /** The error text. When falsy, nothing renders. */
  message: string | null | undefined;
  /** Called when the countdown expires or the user clicks the dismiss ring. */
  onDismiss: () => void;
  /** Total countdown in ms (default 6 s). */
  duration?: number;
  /**
   * Timestamp the error was set (e.g. from the Zustand store). When
   * provided, the countdown continues across component remounts —
   * switching tabs doesn't reset the timer. When omitted, the timer
   * starts fresh on every mount (for local per-page errors).
   */
  since?: number | null;
  className?: string;
};

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_MS = 60;

/**
 * Error banner with a countdown-donut auto-dismiss. The ring drains
 * clockwise from 12 o'clock; when it reaches zero `onDismiss` fires
 * and the error clears. Clicking the ring dismisses immediately.
 * Hovering pauses the countdown so long messages can be read.
 *
 * When `since` is supplied, the countdown computes remaining time
 * from the original timestamp (not mount time) — this keeps the timer
 * coherent across tab navigation for store-level errors.
 */
export function DismissibleError({
  message,
  onDismiss,
  duration = 6000,
  since = null,
  className = "",
}: DismissibleErrorProps) {
  // Anchor the countdown to either the caller-provided timestamp or
  // the moment we first saw this message.
  const anchorRef = useRef<number>(since ?? Date.now());
  const lastMessageRef = useRef(message);
  const dismissedRef = useRef(false);
  const isHoveringRef = useRef(false);
  const hoverAccumRef = useRef(0);
  const hoverEnterRef = useRef<number>(0);

  const [remaining, setRemaining] = useState(() => {
    const base = since ?? Date.now();
    return Math.max(0, duration - (Date.now() - base));
  });

  // Reset only when a new message arrives OR the `since` timestamp
  // changes — not on every remount.
  useEffect(() => {
    if (!message) return;
    if (message !== lastMessageRef.current || (since != null && since !== anchorRef.current)) {
      lastMessageRef.current = message;
      anchorRef.current = since ?? Date.now();
      dismissedRef.current = false;
      hoverAccumRef.current = 0;
      setRemaining(Math.max(0, duration - (Date.now() - anchorRef.current)));
    }
  }, [message, since, duration]);

  useEffect(() => {
    if (!message) return;
    const id = window.setInterval(() => {
      if (isHoveringRef.current) return;
      const elapsed = Date.now() - anchorRef.current - hoverAccumRef.current;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0 && !dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [message, duration, onDismiss]);

  const progress = message ? remaining / duration : 0; // 1 → 0
  // Clockwise drain from 12 o'clock: negate the offset so the dash
  // pattern shifts in the direction that retracts the arc's leading
  // (clockwise) edge while the trailing edge stays pinned at the top.
  const dashOffset = -CIRCUMFERENCE * (1 - progress);

  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key="dismissible-error"
          role="alert"
          layout
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={tween.baseOut}
          onMouseEnter={() => {
            if (isHoveringRef.current) return;
            isHoveringRef.current = true;
            hoverEnterRef.current = Date.now();
          }}
          onMouseLeave={() => {
            if (!isHoveringRef.current) return;
            isHoveringRef.current = false;
            hoverAccumRef.current += Date.now() - hoverEnterRef.current;
          }}
          className={`relative flex items-start gap-2.5 p-3 pr-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700 overflow-hidden ${className}`}
        >
      <div className="flex-1 min-w-0 break-words">{message}</div>
      <motion.button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        whileTap={{ scale: 0.9 }}
        transition={spring.snap}
        className="flex-shrink-0 relative w-5 h-5 flex items-center justify-center text-rose-400 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 rounded-full"
      >
        <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
          <circle
            cx="10"
            cy="10"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1.5}
          />
          <circle
            cx="10"
            cy="10"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 80ms linear" }}
          />
        </svg>
        <svg
          viewBox="0 0 20 20"
          className="absolute w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
      </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
