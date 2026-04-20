import { useWalletStore } from "../store";

/**
 * In-app motion preference — NOT the OS `prefers-reduced-motion` flag.
 *
 * Returns the user's Settings toggle. Defaults to `false` so a fresh
 * install opens lively; anyone who wants reduced motion flips it in
 * Settings. Research §15.8 calls this the "defensive layer": owning
 * the preference avoids Chromium's false-positive OS flag reports
 * (battery saver, post-update macOS defaults, Linux mis-reporting)
 * that would otherwise show users a static wallet on first run.
 *
 * The `<html data-reduce-motion="true">` attribute is mirrored once at
 * the App root (see App.tsx) so `tailwind.css` can key its reduced-
 * motion substitutions off the same source of truth.
 */
export function useReducedMotion(): boolean {
  return useWalletStore((s) => s.reduceMotion);
}
