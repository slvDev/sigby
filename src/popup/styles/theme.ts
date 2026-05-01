/**
 * Sigby visual design tokens.
 *
 * Palette, typography, radius, shadow system. Every UI primitive in
 * `src/popup/components/ui/` reads from here; pages should never
 * re-invent these values inline.
 */

/**
 * SF-first system font stack. Renders as SF on Apple platforms, falls
 * back to the OS system UI font elsewhere.
 */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif";

/**
 * Palette. Small and intentional — background gradient, surface white
 * with alpha, ink (primary), muted (secondary), accent (interactive).
 */
export const palette = {
  /** Full-bleed canvas gradient, top to bottom */
  backgroundGradient:
    "linear-gradient(180deg, #f6f7fb 0%, #eceff6 60%, #e6eaf3 100%)",
  /** Sticky-header gradient overlay, top fade */
  headerGradient:
    "linear-gradient(180deg, rgba(246,247,251,0.95) 0%, rgba(246,247,251,0.7) 100%)",
  /** Solid-looking glass surface at ~78% opacity on white */
  surface: "rgba(255, 255, 255, 0.78)",
  /** Hairline border used on glass surfaces */
  border: "rgba(255, 255, 255, 0.8)",
  /** Primary text */
  ink: "#18181b",
  /** Secondary text */
  muted: "#71717a",
  /** Interactive / active accent */
  accent: "#2563eb",
  /** Subtle accent for chips / dots */
  accentSoft: "#3b82f6",
} as const;

/**
 * Multi-stop soft shadow for elevated glass surfaces.
 */
export const SOFT_SHADOW =
  "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)";

/**
 * Heavier shadow for the balance hero card.
 */
export const HERO_SHADOW =
  "0 1px 2px rgba(15, 23, 42, 0.05), 0 20px 40px -12px rgba(30, 41, 120, 0.18)";

/**
 * Radius scale. 14-20 is the everyday card range; 22 is reserved for
 * the hero balance card.
 */
export const radius = {
  pill: 9999,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  hero: 22,
} as const;

/**
 * Hero balance card gradient overlay. Subtle warm-to-cool wash on top
 * of white. Paired with two decorative orbs in `<HeroCard>`.
 */
export const HERO_SURFACE =
  "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(245,248,255,0.75) 100%)";
