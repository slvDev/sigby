import { useEffect, useRef, useState } from "react";

type DismissibleErrorProps = {
  /** The error text. When falsy, nothing renders. */
  message: string | null | undefined;
  /** Called when the countdown expires or the user clicks the dismiss ring. */
  onDismiss: () => void;
  /** Total countdown in ms (default 6 s). */
  duration?: number;
  className?: string;
};

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_MS = 60;

/**
 * Error banner with a countdown-donut auto-dismiss. The ring drains
 * clockwise; when it reaches zero the `onDismiss` callback fires and
 * the error clears. Clicking the ring dismisses immediately. Hovering
 * the card pauses the countdown so the user can read long messages.
 */
export function DismissibleError({
  message,
  onDismiss,
  duration = 6000,
  className = "",
}: DismissibleErrorProps) {
  const [remaining, setRemaining] = useState(duration);
  const dismissedRef = useRef(false);
  const isHoveringRef = useRef(false);
  const startRef = useRef<number>(Date.now());
  const accumulatedRef = useRef(0);

  // Reset the timer whenever a fresh message arrives.
  useEffect(() => {
    if (!message) return;
    dismissedRef.current = false;
    isHoveringRef.current = false;
    startRef.current = Date.now();
    accumulatedRef.current = 0;
    setRemaining(duration);
  }, [message, duration]);

  useEffect(() => {
    if (!message) return;
    const id = window.setInterval(() => {
      if (isHoveringRef.current) {
        // Freeze the clock while hovering — restart the baseline.
        startRef.current = Date.now();
        return;
      }
      const elapsed = Date.now() - startRef.current + accumulatedRef.current;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0 && !dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const progress = remaining / duration; // 1 → 0
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div
      role="alert"
      onMouseEnter={() => {
        if (isHoveringRef.current) return;
        // Capture elapsed-so-far into accumulated buffer; pause the baseline.
        accumulatedRef.current += Date.now() - startRef.current;
        isHoveringRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveringRef.current = false;
        startRef.current = Date.now();
      }}
      className={`relative flex items-start gap-2.5 p-3 pr-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700 ${className}`}
    >
      <div className="flex-1 min-w-0 break-words">{message}</div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
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
      </button>
    </div>
  );
}
