/**
 * Motion preference — always full motion.
 *
 * Kept as a hook (not inlined) so the primitives that branch on it
 * (NumberScramble, HexScramble, InitialMorph, CelebrationGlow,
 * HeroCard) keep their reduced-motion fallbacks as dead-but-ready
 * code. If we ever need to re-introduce a preference (OS flag, user
 * toggle, something else), we change this file only.
 */
export function useReducedMotion(): boolean {
  return false;
}
