import { useEffect, useState } from "react";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Reads `prefers-reduced-motion: reduce` with live updates. Safe for
 * SSR / first-paint because it reads `matchMedia` only inside the
 * effect; initial render returns `false` and corrects on hydration.
 *
 * Motion's `<MotionConfig reducedMotion="user">` already gates
 * `transform`/`layout` animations globally, but bespoke CSS animations
 * and JS branches (e.g. substituting a number-ticker for an instant
 * swap) still need this boolean.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MEDIA_QUERY);
    setReduced(mq.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  return reduced;
}
