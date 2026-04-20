import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../../hooks";

type HexScrambleProps = {
  /**
   * The true string to render. Scramble is a purely visual effect —
   * this prop is the single source of truth for any consumer that
   * needs the real value (e.g. a clipboard copy handler). The
   * scrambled characters rendered during the animation MUST NOT flow
   * back into consumer logic.
   */
  text: string;
  /**
   * Trigger a fresh scramble when this key changes (typically the
   * active account address so switching accounts re-scrambles).
   * Re-mounts of the component with the same key do not scramble.
   */
  scrambleKey?: string | number;
  /** Total scramble duration in ms before the text settles. */
  durationMs?: number;
  className?: string;
};

const HEX_CHARS = "0123456789abcdef";

function randHex(count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    out += HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
  }
  return out;
}

/**
 * Identity-shift scramble for addresses / hex text. Each column
 * randomises through hex for a moment, then per-column lands on the
 * true character left-to-right so the final state sweeps in.
 *
 * Per-column landing order makes the scramble read as *resolving*,
 * not *stopping*. All-at-once landing felt like a bug.
 *
 * Reduced-motion: renders `text` verbatim with no animation.
 */
export function HexScramble({
  text,
  scrambleKey,
  durationMs = 420,
  className = "",
}: HexScrambleProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const scrambleKeyRef = useRef(scrambleKey);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      scrambleKeyRef.current = scrambleKey;
      setDisplay(text);
      return;
    }

    // Key unchanged → just reflect new text without scramble.
    if (scrambleKey === scrambleKeyRef.current) {
      setDisplay(text);
      return;
    }

    scrambleKeyRef.current = scrambleKey;

    if (reduced) {
      setDisplay(text);
      return;
    }

    // Build a mask of "which column has landed" progressing left→right
    // over the duration. Before a column lands, it reads random hex
    // that cycles every frame; after, it reads the real character.
    const totalCols = text.length;
    const frameMs = 40;
    const totalFrames = Math.max(totalCols, Math.floor(durationMs / frameMs));
    let frame = 0;

    const id = window.setInterval(() => {
      frame += 1;
      const landedUpTo = Math.floor((frame / totalFrames) * totalCols);
      let next = "";
      for (let i = 0; i < totalCols; i++) {
        const ch = text[i];
        // Preserve non-alphanumeric characters (e.g. "0x" prefix is
        // ambient, "…" ellipsis in truncated display) — they shouldn't
        // scramble because they're not part of the identity.
        if (i < landedUpTo || !/[0-9a-fA-F]/.test(ch)) {
          next += ch;
        } else {
          next += randHex(1);
        }
      }
      setDisplay(next);
      if (frame >= totalFrames) {
        window.clearInterval(id);
        setDisplay(text);
      }
    }, frameMs);

    return () => window.clearInterval(id);
  }, [text, scrambleKey, reduced, durationMs]);

  return (
    <motion.span className={className} aria-label={text}>
      {display}
    </motion.span>
  );
}
